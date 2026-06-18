import logging
from datetime import date

from django.conf import settings
from django.db.models import Count, Prefetch
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsTraveller
from listings.models import Listing
from packages.models import Package, PackageSlot
from recommendations.serializers import (
    EventBatchSerializer,
    ForYouRecommendationMetaSerializer,
    InteractionBatchSerializer,
    RecommendedPackageSerializer,
    RecommendedListingSerializer,
    RecommendationMetaSerializer,
)
from recommendations.services.recommendation_service import (
    get_for_you_packages,
    get_for_you_listings,
    get_similar_listings,
)
from recommendations.services.tracking_service import (
    create_served_slate,
    persist_events,
    persist_listing_interactions,
)

logger = logging.getLogger('recommendations')


def _fetch_ordered_listings(listing_ids: list[int]) -> list[Listing]:
    if not listing_ids:
        return []

    listings_map = {
        listing.pk: listing
        for listing in Listing.objects.filter(pk__in=listing_ids)
        .select_related('host', 'host__user')
        .prefetch_related('images')
    }
    return [listings_map[listing_id] for listing_id in listing_ids if listing_id in listings_map]


def _annotate_positions(listings: list[Listing]) -> None:
    for i, listing in enumerate(listings, start=1):
        listing.position = i


def _build_results_detail(listings: list[Listing], results_detail: list[dict]) -> list[dict]:
    distance_map = {
        item['listing_id']: item.get('distance')
        for item in results_detail
    }
    return [
        {'listing_id': listing.pk, 'distance': distance_map.get(listing.pk)}
        for listing in listings
    ]


def _fetch_ordered_packages(package_ids: list[int]) -> list[Package]:
    if not package_ids:
        return []

    today = date.today()
    packages_map = {
        package.pk: package
        for package in (
            Package.objects.filter(pk__in=package_ids)
            .select_related('host', 'host__user')
            .annotate(listing_count=Count('package_listings', distinct=True))
            .prefetch_related(
                Prefetch(
                    'slots',
                    queryset=PackageSlot.objects.filter(
                        is_active=True,
                        start_date__gte=today,
                    ).order_by('start_date'),
                    to_attr='upcoming_slots',
                )
            )
        )
    }
    return [packages_map[package_id] for package_id in package_ids if package_id in packages_map]


def _serialize_meta(
    request_id,
    strategy: str,
    model_version: str,
    *,
    used_fallback: bool = False,
    personalized_count: int = 0,
    fallback_count: int = 0,
    behavior_event_count: int = 0,
    behavior_listing_count: int = 0,
    recommendation_event_count: int | None = None,
    interaction_event_count: int | None = None,
    behavior_signal_source: str | None = None,
) -> dict:
    payload = {
        'request_id': request_id,
        'strategy': strategy,
        'model_version': model_version,
        'used_fallback': used_fallback,
        'personalized_count': personalized_count,
        'fallback_count': fallback_count,
        'behavior_event_count': behavior_event_count,
        'behavior_listing_count': behavior_listing_count,
    }

    serializer_class = RecommendationMetaSerializer
    if (
        recommendation_event_count is not None
        or interaction_event_count is not None
        or behavior_signal_source is not None
    ):
        payload.update({
            'recommendation_event_count': recommendation_event_count or 0,
            'interaction_event_count': interaction_event_count or 0,
            'behavior_signal_source': behavior_signal_source or 'none',
        })
        serializer_class = ForYouRecommendationMetaSerializer

    return serializer_class(payload).data


def _build_for_you_serving_metadata(result) -> dict:
    return {
        'behavior_signal_source': result.behavior_signal_source,
        'recommendation_event_count': result.recommendation_event_count,
        'interaction_event_count': result.interaction_event_count,
        'behavior_event_count': result.behavior_event_count,
        'behavior_listing_count': result.behavior_listing_count,
    }


class SimilarListingsView(APIView):
    """
    GET /api/recommendations/listings/<id>/similar/

    Return content-based similar listing recommendations for a given listing.

    Access: Public.
    Response includes tracking metadata for frontend event correlation.
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        limit = request.query_params.get('limit')
        if limit:
            try:
                limit = min(int(limit), 20)
            except (TypeError, ValueError):
                limit = None

        result = get_similar_listings(listing_id=pk, limit=limit)
        listings = _fetch_ordered_listings(result.listing_ids)
        _annotate_positions(listings)

        serializer = RecommendedListingSerializer(
            listings,
            many=True,
            context={'request': request},
        )

        user = request.user if request.user.is_authenticated else None
        session_id = '' if user else request.query_params.get('session_id', '')

        try:
            served_set = create_served_slate(
                user=user,
                session_id=session_id,
                surface='similar',
                strategy=result.strategy,
                model_version=result.model_version,
                seed_listing_id=result.seed_listing_id,
                results=_build_results_detail(listings, result.results_detail),
            )
            meta = _serialize_meta(
                served_set.request_id,
                result.strategy,
                result.model_version_label,
                used_fallback=result.used_fallback,
                personalized_count=result.personalized_count,
                fallback_count=result.fallback_count,
            )
        except Exception:
            logger.exception("Failed to create served slate for similar listings")
            meta = _serialize_meta(
                None,
                result.strategy,
                result.model_version_label,
                used_fallback=result.used_fallback,
                personalized_count=result.personalized_count,
                fallback_count=result.fallback_count,
            )

        return Response({
            'count': len(serializer.data),
            'meta': meta,
            'results': serializer.data,
        })


class ForYouListingsView(APIView):
    """
    GET /api/recommendations/for-you/

    Return personalized recommendations based on traveller preferences,
    optionally enhanced with behavior signals.

    Access: Authenticated travellers only.
    Response includes tracking metadata for frontend event correlation.
    """
    permission_classes = [IsAuthenticated, IsTraveller]

    def get(self, request):
        limit = request.query_params.get('limit')
        if limit:
            try:
                limit = min(int(limit), 40)
            except (TypeError, ValueError):
                limit = None

        result = get_for_you_listings(user=request.user, limit=limit)
        listings = _fetch_ordered_listings(result.listing_ids)
        _annotate_positions(listings)

        serializer = RecommendedListingSerializer(
            listings,
            many=True,
            context={'request': request},
        )

        try:
            served_set = create_served_slate(
                user=request.user,
                surface='for_you',
                strategy=result.strategy,
                model_version=result.model_version,
                results=_build_results_detail(listings, result.results_detail),
                serving_metadata=_build_for_you_serving_metadata(result),
            )
            meta = _serialize_meta(
                served_set.request_id,
                result.strategy,
                result.model_version_label,
                used_fallback=result.used_fallback,
                personalized_count=result.personalized_count,
                fallback_count=result.fallback_count,
                behavior_event_count=result.behavior_event_count,
                behavior_listing_count=result.behavior_listing_count,
                recommendation_event_count=result.recommendation_event_count,
                interaction_event_count=result.interaction_event_count,
                behavior_signal_source=result.behavior_signal_source,
            )
        except Exception:
            logger.exception("Failed to create served slate for for-you")
            meta = _serialize_meta(
                None,
                result.strategy,
                result.model_version_label,
                used_fallback=result.used_fallback,
                personalized_count=result.personalized_count,
                fallback_count=result.fallback_count,
                behavior_event_count=result.behavior_event_count,
                behavior_listing_count=result.behavior_listing_count,
                recommendation_event_count=result.recommendation_event_count,
                interaction_event_count=result.interaction_event_count,
                behavior_signal_source=result.behavior_signal_source,
            )

        return Response({
            'count': len(serializer.data),
            'meta': meta,
            'results': serializer.data,
        })


class ForYouPackagesView(APIView):
    """
    GET /api/recommendations/packages/for-you/

    Return personalized package recommendations derived from the existing listing recommender.

    Access: Authenticated travellers only.

    Note:
        This MVP does not create ServedRecommendationSet rows because the current recommendation tracking schema is listing-centric.
    """
    permission_classes = [IsAuthenticated, IsTraveller]

    def get(self, request):
        limit = request.query_params.get('limit')
        if limit:
            try:
                limit = min(int(limit), 20)
            except (TypeError, ValueError):
                limit = None

        result = get_for_you_packages(user=request.user, limit=limit)
        packages = _fetch_ordered_packages(result.package_ids)
        _annotate_positions(packages)

        serializer = RecommendedPackageSerializer(
            packages,
            many=True,
            context={'request': request},
        )

        meta = _serialize_meta(
            None,
            result.strategy,
            result.model_version_label,
            used_fallback=result.used_fallback,
            personalized_count=result.personalized_count,
            fallback_count=result.fallback_count,
            behavior_event_count=result.behavior_event_count,
            behavior_listing_count=result.behavior_listing_count,
            recommendation_event_count=result.recommendation_event_count,
            interaction_event_count=result.interaction_event_count,
            behavior_signal_source=result.behavior_signal_source,
        )

        return Response({
            'count': len(serializer.data),
            'meta': meta,
            'results': serializer.data,
        })


class EventIngestionView(APIView):
    """
    POST /api/recommendations/events/

    Accept a batch of frontend interaction events tied to recommendation slates.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'event_ingestion'

    def get_throttles(self):
        rates = settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES', {})
        if self.throttle_scope not in rates:
            return []
        return super().get_throttles()

    def post(self, request):
        serializer = EventBatchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'detail': 'Invalid event batch.',
                    'code': 'invalid_event_batch',
                    'errors': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        validated_events = serializer.validated_data['events']
        user = request.user if request.user.is_authenticated else None

        identity_errors = []
        valid_events = []
        for i, event in enumerate(validated_events):
            has_user = user is not None
            has_session = bool(event.get('session_id'))
            if not has_user and not has_session:
                identity_errors.append({
                    'index': i,
                    'detail': 'Either authenticated user or session_id is required.',
                })
            else:
                valid_events.append(event)

        if not valid_events:
            return Response(
                {
                    'accepted': 0,
                    'rejected': len(validated_events),
                    'errors': identity_errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = persist_events(
            validated_events=valid_events,
            user=user,
        )
        result['rejected'] += len(identity_errors)
        result['errors'] = identity_errors + result['errors']

        http_status = status.HTTP_202_ACCEPTED
        if result['accepted'] == 0 and result['rejected'] > 0:
            http_status = status.HTTP_400_BAD_REQUEST

        return Response(result, status=http_status)


class InteractionIngestionView(APIView):
    """
    POST /api/recommendations/interactions/

    Accept a batch of general listing browsing interaction events.

    Unlike EventIngestionView (which handle recommendation-attribution events tied to served slates), this endpoint handles broader browsing interactions from catalog, search results, and listing detail pages.

    Requires authentication. Anonymous events are rejected.
    """
    permission_classes = [IsAuthenticated]
    throttle_scope = 'interaction_ingestion'
    def get_throttles(self):
        rates = settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES', {})
        if self.throttle_scope not in rates:
            return []
        return super().get_throttles()

    def post(self, request):
        serializer = InteractionBatchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'detail': 'Invalid interaction batch.',
                    'code': 'invalid_interaction_batch',
                    'errors': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        validated_events = serializer.validated_data['events']

        result = persist_listing_interactions(
            validated_events=validated_events,
            user=request.user,
        )

        http_status = status.HTTP_202_ACCEPTED
        if result['accepted'] == 0 and result['rejected'] > 0:
            http_status = status.HTTP_400_BAD_REQUEST

        return Response(
            result,
            status=http_status
        )
    
