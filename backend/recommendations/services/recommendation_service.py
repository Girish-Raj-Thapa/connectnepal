import logging
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from math import log1p

from django.conf import settings
from django.core.cache import caches

from accounts.models import TravellerDetail
from listings.models import Listing
from packages.models import Package
from recommendations.models import RecommendationModelVersion
from recommendations.services.artifact_loader import ArtifactLoadError
from recommendations.services.behavior_profile_service import (
    _SPARSE_PROFILE,
    build_behavior_profile,
)
from recommendations.services.behavior_rebuild_scheduler_service import (
    queue_behavior_profile_rebuild,
)
from recommendations.services.behavior_query_builder_service import build_behavior_query
from recommendations.services.behavior_snapshot_service import (
    load_behavior_profile_snapshot,
)
from recommendations.services.cache_versioning_service import (
    bump_catalog_generation,
    get_catalog_generation,
    get_user_behavior_generation,
    get_user_preference_generation,
)
from recommendations.services.filters import (
    budget_aware_rerank,
    filter_eligible_listings,
    get_popular_fallback_ids,
    light_rerank,
)
from recommendations.services.preprocessing import preprocess_listing
from recommendations.services.retrieval_service import (
    get_active_model_version,
    retrieve_for_you,
    retrieve_similar,
)
from recommendations.services.vectorizer import vectorize_listing
from utils.exceptions import ServiceError

logger = logging.getLogger('recommendations')

cache = caches['recommendations']

_PACKAGE_MULTIPLE_MATCH_BONUS = 0.2
_PACKAGE_RATING_BOOST_WEIGHT = 0.15
_PACKAGE_POPULARITY_BOOST_WEIGHT = 0.1
_PACKAGE_NEAR_TERM_SLOT_BOOST = 0.05
_PACKAGE_FALLBACK_SCORE = 0.15


@dataclass(frozen=True)
class RecommendationResult:
    """
    Structured result from the recommendation service.

    Carries strategy, model version, per-result distance data, and behavior serving metadata alongside the ordered listing IDs so the view layer can create served slates without re-querying retrieval data.
    """
    listing_ids: list[int]
    strategy: str
    model_version_label: str
    model_version: RecommendationModelVersion | None
    results_detail: list[dict]
    used_fallback: bool = False
    personalized_count: int = 0
    fallback_count: int = 0
    seed_listing_id: int | None = None
    behavior_event_count: int = 0
    behavior_listing_count: int = 0
    recommendation_event_count: int = 0
    interaction_event_count: int = 0
    behavior_signal_source: str = 'none'


@dataclass(frozen=True)
class PackageRecommendationResult:
    """
    Structured result for package recommendations built on top of listing recommendations.

    This MVP lifts the existing listing recommendation output into package candidates via PackageListing and carries the same behavior metadata forward for response diagnostics.
    """
    package_ids: list[int]
    strategy: str
    model_version_label: str
    model_version: RecommendationModelVersion | None
    results_detail: list[dict]
    used_fallback: bool = False
    personalized_count: int = 0
    fallback_count: int = 0
    behavior_event_count: int = 0
    behavior_listing_count: int = 0
    recommendation_event_count: int = 0
    interaction_event_count: int = 0
    behavior_signal_source: str = 'none'


def get_similar_listings(
    listing_id: int,
    limit: int | None = None,
) -> RecommendationResult:
    """
    Orchestrate similar listing recommendations for a given listing.

    Raises ServiceError if the source listing is not found or inactive.
    """
    if limit is None:
        limit = settings.RECOMMENDATION_SIMILAR_LIMIT

    model_version = get_active_model_version()
    if model_version is None:
        logger.warning(
            "Recommendation served",
            extra={
                'surface': 'similar',
                'source_listing_id': listing_id,
                'is_fallback': True,
                'fallback_reason': 'no_active_model',
            },
        )
        fallback_ids = get_popular_fallback_ids(
            limit=limit,
            exclude_ids=[listing_id],
        )
        return _build_result(
            listing_ids=fallback_ids,
            strategy='popular_fallback',
            model_version=None,
            seed_listing_id=listing_id,
        )

    cache_key = _similar_cache_key(listing_id, model_version.pk)
    cached = cache.get(cache_key)
    if cached is not None:
        logger.debug("Cache hit for similar listings: listing=%d", listing_id)
        cached_results = _normalize_cached_results(cached, limit)
        return _build_result(
            listing_ids=[item['listing_id'] for item in cached_results],
            strategy='content_based',
            model_version=model_version,
            results_detail=cached_results,
            seed_listing_id=listing_id,
        )

    try:
        listing = Listing.objects.select_related('host', 'host__user').get(
            pk=listing_id,
            is_active=True,
        )
    except Listing.DoesNotExist:
        raise ServiceError(
            detail=f"Listing {listing_id} not found or inactive.",
            status_code=404,
        )

    try:
        preprocessed = preprocess_listing(listing)
        query_vector = vectorize_listing(preprocessed)
    except ArtifactLoadError as e:
        logger.error("Artifact load failed during similar reco: %s", e)
        fallback_ids = get_popular_fallback_ids(
            limit=limit,
            exclude_ids=[listing_id],
        )
        return _build_result(
            listing_ids=fallback_ids,
            strategy='popular_fallback',
            model_version=model_version,
            seed_listing_id=listing_id,
        )
    except Exception as e:
        logger.exception("Vectorization failed for listing %d: %s", listing_id, e)
        fallback_ids = get_popular_fallback_ids(
            limit=limit,
            exclude_ids=[listing_id],
        )
        return _build_result(
            listing_ids=fallback_ids,
            strategy='popular_fallback',
            model_version=model_version,
            seed_listing_id=listing_id,
        )

    candidates = retrieve_similar(
        query_vector=query_vector,
        model_version=model_version,
        exclude_listing_ids=[listing_id],
    )

    if not candidates:
        logger.info(
            "Recommendation served",
            extra={
                'surface': 'similar',
                'source_listing_id': listing_id,
                'is_fallback': True,
                'fallback_reason': 'no_candidates',
            },
        )
        fallback_ids = get_popular_fallback_ids(
            limit=limit,
            exclude_ids=[listing_id],
        )
        return _build_result(
            listing_ids=fallback_ids,
            strategy='popular_fallback',
            model_version=model_version,
            seed_listing_id=listing_id,
        )

    candidate_ids = [candidate['listing_id'] for candidate in candidates]
    eligible_ids = filter_eligible_listings(
        listing_ids=candidate_ids,
        exclude_listing_ids=[listing_id],
    )
    result_ids = light_rerank(candidates, eligible_ids, limit=limit)
    distance_map = {
        candidate['listing_id']: candidate.get('distance')
        for candidate in candidates
    }
    results_detail = [
        {'listing_id': result_id, 'distance': distance_map.get(result_id)}
        for result_id in result_ids
    ]

    cache.set(
        cache_key,
        results_detail,
        timeout=settings.RECOMMENDATION_CACHE_TTL_SIMILAR,
    )

    logger.info(
        "Recommendation served",
        extra={
            'surface': 'similar',
            'source_listing_id': listing_id,
            'result_count': len(result_ids),
            'candidate_count': len(candidates),
            'eligible_count': len(eligible_ids),
            'model_version': model_version.version_label,
            'is_fallback': False,
        },
    )

    return _build_result(
        listing_ids=result_ids,
        strategy='content_based',
        model_version=model_version,
        results_detail=results_detail,
        seed_listing_id=listing_id,
    )


def get_for_you_packages(
    user,
    limit: int | None = None,
) -> PackageRecommendationResult:
    """
    Build package recommendations by lifting the current listing recommender output.

    The flow is intentionally simple for the MVP:
      1. get the user's top recommended listings
      2. map those listings upward to packages through PackageListing
      3. rank packages by aggregate matched-child score plus light quality boosts
      4. hard-filter inactive, unpublished, over-budget, and no-slot packages
    """
    if limit is None:
        limit = min(settings.RECOMMENDATION_FOR_YOU_LIMIT, 10)

    listing_result = get_for_you_listings(
        user=user,
        limit=_package_source_listing_limit(limit),
    )

    try:
        traveller = user.traveller_detail
    except TravellerDetail.DoesNotExist:
        traveller = None

    max_price = traveller.preferred_max_budget if traveller else None
    package_results = _rank_packages_from_listing_result(
        listing_result=listing_result,
        max_price=max_price,
        limit=limit,
    )

    if package_results:
        return _build_package_result(
            package_ids=[item['package_id'] for item in package_results],
            strategy=listing_result.strategy,
            model_version=listing_result.model_version,
            results_detail=package_results,
            behavior_event_count=listing_result.behavior_event_count,
            behavior_listing_count=listing_result.behavior_listing_count,
            recommendation_event_count=listing_result.recommendation_event_count,
            interaction_event_count=listing_result.interaction_event_count,
            behavior_signal_source=listing_result.behavior_signal_source,
        )

    fallback_results = _get_popular_package_fallback(
        max_price=max_price,
        limit=limit,
    )
    return _build_package_result(
        package_ids=[item['package_id'] for item in fallback_results],
        strategy='popular_fallback',
        model_version=listing_result.model_version,
        results_detail=fallback_results,
        behavior_event_count=listing_result.behavior_event_count,
        behavior_listing_count=listing_result.behavior_listing_count,
        recommendation_event_count=listing_result.recommendation_event_count,
        interaction_event_count=listing_result.interaction_event_count,
        behavior_signal_source=listing_result.behavior_signal_source,
    )


def get_for_you_listings(user, limit: int | None = None) -> RecommendationResult:
    """
    Orchestrate "for you" recommendations for a traveller.

    Integrates behavior-enhanced personalization when the user has sufficient interaction history. Sparse users fall back to preference-only retrieval.

    Returns a RecommendationResult.
    """
    if limit is None:
        limit = settings.RECOMMENDATION_FOR_YOU_LIMIT

    try:
        prefs = user.traveller_detail
    except TravellerDetail.DoesNotExist:
        prefs = None

    min_price = _coerce_decimal(prefs.preferred_min_budget) if prefs else None
    max_price = _coerce_decimal(prefs.preferred_max_budget) if prefs else None
    has_preferences = prefs and (
        prefs.preferred_activities
        or prefs.preferred_min_budget
        or prefs.preferred_max_budget
        or prefs.preferred_trip_style
    )

    model_version = get_active_model_version()
    if model_version is None:
        logger.warning(
            "Recommendation served",
            extra={
                'surface': 'for_you',
                'user_id': user.pk,
                'is_fallback': True,
                'fallback_reason': 'no_active_model',
            },
        )
        fallback_ids = get_popular_fallback_ids(
            limit=limit,
            max_price=max_price,
            min_price=min_price,
        )
        return _build_result(
            listing_ids=fallback_ids,
            strategy='popular_fallback',
            model_version=None,
        )

    catalog_generation = get_catalog_generation()
    preference_generation = get_user_preference_generation(user.pk)
    behavior_generation = get_user_behavior_generation(user.pk)
    cache_key = _for_you_cache_key(
        user_id=user.pk,
        version_id=model_version.pk,
        catalog_generation=catalog_generation,
        preference_generation=preference_generation,
        behavior_generation=behavior_generation,
        limit=limit,
    )
    cached = cache.get(cache_key)
    if cached is not None:
        logger.debug("Cache hit for for-you: user=%d", user.pk)
        cache_payload = _normalize_for_you_cache(cached, limit)
        return _build_result(
            listing_ids=[item['listing_id'] for item in cache_payload['results']],
            strategy=cache_payload['strategy'],
            model_version=model_version,
            results_detail=cache_payload['results'],
            behavior_event_count=cache_payload.get('behavior_event_count', 0),
            behavior_listing_count=cache_payload.get('behavior_listing_count', 0),
            recommendation_event_count=cache_payload.get(
                'recommendation_event_count', 0
            ),
            interaction_event_count=cache_payload.get('interaction_event_count', 0),
            behavior_signal_source=cache_payload.get(
                'behavior_signal_source', 'none'
            ),
        )

    if not has_preferences:
        logger.info(
            "Recommendation served",
            extra={
                'surface': 'for_you',
                'user_id': user.pk,
                'is_fallback': True,
                'fallback_reason': 'no_preferences',
            },
        )
        fallback_ids = get_popular_fallback_ids(
            limit=limit,
            max_price=max_price,
            min_price=min_price,
        )
        results_detail = _detail_list_from_ids(fallback_ids)
        cache.set(
            cache_key,
            {
                'strategy': 'popular_fallback',
                'results': results_detail,
                'behavior_event_count': 0,
                'behavior_listing_count': 0,
                'recommendation_event_count': 0,
                'interaction_event_count': 0,
                'behavior_signal_source': 'none',
            },
            timeout=settings.RECOMMENDATION_CACHE_TTL_POPULAR,
        )
        return _build_result(
            listing_ids=fallback_ids,
            strategy='popular_fallback',
            model_version=model_version,
            results_detail=results_detail,
        )

    behavior_profile = _SPARSE_PROFILE
    behavior_profile_source = 'disabled'
    if settings.RECOMMENDATION_BEHAVIOR_ENABLED:
        behavior_profile, behavior_profile_source = _resolve_behavior_profile(
            user_id=user.pk,
            model_version=model_version,
        )

    try:
        query_result = build_behavior_query(
            user=user,
            behavior_profile=behavior_profile,
        )
    except ArtifactLoadError as e:
        logger.error("Artifact load failed during for-you query build: %s", e)
        fallback_ids = get_popular_fallback_ids(
            limit=limit,
            max_price=max_price,
            min_price=min_price,
        )
        return _build_result(
            listing_ids=fallback_ids,
            strategy='popular_fallback',
            model_version=model_version,
        )
    except Exception as e:
        logger.exception("Query build failed for user %d during for-you: %s", user.pk, e)
        fallback_ids = get_popular_fallback_ids(
            limit=limit,
            max_price=max_price,
            min_price=min_price,
        )
        return _build_result(
            listing_ids=fallback_ids,
            strategy='popular_fallback',
            model_version=model_version,
        )

    strategy = query_result.strategy
    query_vector = query_result.query_vector
    behavior_event_count = query_result.behavior_event_count
    behavior_listing_count = query_result.behavior_listing_count
    recommendation_event_count = query_result.recommendation_event_count
    interaction_event_count = query_result.interaction_event_count
    behavior_signal_source = query_result.behavior_signal_source

    candidates = retrieve_for_you(
        query_vector=query_vector,
        model_version=model_version,
    )

    if not candidates:
        logger.info(
            "Recommendation served",
            extra={
                'surface': 'for_you',
                'user_id': user.pk,
                'is_fallback': True,
                'fallback_reason': 'no_candidates',
                'strategy': strategy,
                'behavior_used': query_result.behavior_used,
                'behavior_signal_source': behavior_signal_source,
                'behavior_profile_source': behavior_profile_source,
                'behavior_event_count': behavior_event_count,
                'behavior_listing_count': behavior_listing_count,
                'recommendation_event_count': recommendation_event_count,
                'interaction_event_count': interaction_event_count,
            },
        )
        fallback_ids = get_popular_fallback_ids(
            limit=limit,
            max_price=max_price,
            min_price=min_price,
        )
        results_detail = _detail_list_from_ids(fallback_ids)
        cache.set(
            cache_key,
            {
                'strategy': 'popular_fallback',
                'results': results_detail,
                'behavior_event_count': behavior_event_count,
                'behavior_listing_count': behavior_listing_count,
                'recommendation_event_count': recommendation_event_count,
                'interaction_event_count': interaction_event_count,
                'behavior_signal_source': behavior_signal_source,
            },
            timeout=settings.RECOMMENDATION_CACHE_TTL_POPULAR,
        )
        return _build_result(
            listing_ids=fallback_ids,
            strategy='popular_fallback',
            model_version=model_version,
            results_detail=results_detail,
            behavior_event_count=behavior_event_count,
            behavior_listing_count=behavior_listing_count,
            recommendation_event_count=recommendation_event_count,
            interaction_event_count=interaction_event_count,
            behavior_signal_source=behavior_signal_source,
        )

    candidate_ids = [candidate['listing_id'] for candidate in candidates]
    eligible_ids = filter_eligible_listings(
        listing_ids=candidate_ids,
        max_price=max_price,
    )
    if min_price is not None:
        listing_prices = _get_listing_price_map(candidate_ids)
        result_ids = budget_aware_rerank(
            candidates=candidates,
            eligible_ids=eligible_ids,
            listing_prices=listing_prices,
            min_price=min_price,
            limit=limit,
        )
    else:
        result_ids = light_rerank(candidates, eligible_ids, limit=limit)
    distance_map = {
        candidate['listing_id']: candidate.get('distance')
        for candidate in candidates
    }
    results_detail = [
        {'listing_id': result_id, 'distance': distance_map.get(result_id)}
        for result_id in result_ids
    ]

    if len(result_ids) < limit:
        fallback_ids = get_popular_fallback_ids(
            limit=limit - len(result_ids),
            exclude_ids=result_ids,
            max_price=max_price,
            min_price=min_price,
        )
        result_ids.extend(fallback_ids)
        results_detail.extend(_detail_list_from_ids(fallback_ids))

    cache.set(
        cache_key,
        {
            'strategy': strategy,
            'results': results_detail,
            'behavior_event_count': behavior_event_count,
            'behavior_listing_count': behavior_listing_count,
            'recommendation_event_count': recommendation_event_count,
            'interaction_event_count': interaction_event_count,
            'behavior_signal_source': behavior_signal_source,
        },
        timeout=settings.RECOMMENDATION_CACHE_TTL_FOR_YOU,
    )

    personalized_count = len(
        [item for item in results_detail if item.get('distance') is not None]
    )
    fallback_count = len(
        [item for item in results_detail if item.get('distance') is None]
    )

    logger.info(
        "Recommendation served",
        extra={
            'surface': 'for_you',
            'user_id': user.pk,
            'result_count': len(result_ids),
            'candidate_count': len(candidates),
            'eligible_count': len(eligible_ids),
            'personalized_count': personalized_count,
            'fallback_count': fallback_count,
            'model_version': model_version.version_label,
            'is_fallback': fallback_count > 0,
            'has_preferences': True,
            'strategy': strategy,
            'behavior_used': query_result.behavior_used,
            'alpha_applied': query_result.alpha_applied,
            'behavior_signal_source': behavior_signal_source,
            'behavior_profile_source': behavior_profile_source,
            'behavior_event_count': behavior_event_count,
            'behavior_listing_count': behavior_listing_count,
            'recommendation_event_count': recommendation_event_count,
            'interaction_event_count': interaction_event_count,
        },
    )

    return _build_result(
        listing_ids=result_ids,
        strategy=strategy,
        model_version=model_version,
        results_detail=results_detail,
        behavior_event_count=behavior_event_count,
        behavior_listing_count=behavior_listing_count,
        recommendation_event_count=recommendation_event_count,
        interaction_event_count=interaction_event_count,
        behavior_signal_source=behavior_signal_source,
    )


def _resolve_behavior_profile(
    *,
    user_id: int,
    model_version: RecommendationModelVersion,
):
    try:
        snapshot_profile = load_behavior_profile_snapshot(
            user_id=user_id,
            model_version=model_version,
        )
    except Exception:
        logger.exception(
            "Failed to load behavior snapshot for user %d and model version %s",
            user_id,
            model_version.pk,
        )
        snapshot_profile = None

    if snapshot_profile is not None:
        logger.debug(
            "Behavior snapshot hit for user %d and model version %s",
            user_id,
            model_version.pk,
        )
        return snapshot_profile, 'snapshot'

    logger.info(
        "Behavior snapshot miss for user %d and model version %s; using sync fallback",
        user_id,
        model_version.pk,
    )
    behavior_profile = build_behavior_profile(
        user_id=user_id,
        model_version=model_version,
    )
    queue_behavior_profile_rebuild(user_id=user_id)
    return behavior_profile, 'sync_fallback'


def _build_result(
    *,
    listing_ids: list[int],
    strategy: str,
    model_version: RecommendationModelVersion | None,
    results_detail: list[dict] | None = None,
    seed_listing_id: int | None = None,
    behavior_event_count: int = 0,
    behavior_listing_count: int = 0,
    recommendation_event_count: int = 0,
    interaction_event_count: int = 0,
    behavior_signal_source: str = 'none',
) -> RecommendationResult:
    if results_detail is None:
        results_detail = _detail_list_from_ids(listing_ids)

    used_fallback, personalized_count, fallback_count = _derive_fallback_mix(
        strategy=strategy,
        listing_ids=listing_ids,
        results_detail=results_detail,
    )

    return RecommendationResult(
        listing_ids=listing_ids,
        strategy=strategy,
        model_version_label=model_version.version_label if model_version else '',
        model_version=model_version,
        results_detail=results_detail,
        used_fallback=used_fallback,
        personalized_count=personalized_count,
        fallback_count=fallback_count,
        seed_listing_id=seed_listing_id,
        behavior_event_count=behavior_event_count,
        behavior_listing_count=behavior_listing_count,
        recommendation_event_count=recommendation_event_count,
        interaction_event_count=interaction_event_count,
        behavior_signal_source=behavior_signal_source,
    )


def _build_package_result(
    *,
    package_ids: list[int],
    strategy: str,
    model_version: RecommendationModelVersion | None,
    results_detail: list[dict] | None = None,
    behavior_event_count: int = 0,
    behavior_listing_count: int = 0,
    recommendation_event_count: int = 0,
    interaction_event_count: int = 0,
    behavior_signal_source: str = 'none',
) -> PackageRecommendationResult:
    if results_detail is None:
        results_detail = [
            {'package_id': package_id, 'score': 0.0}
            for package_id in package_ids
        ]

    used_fallback = strategy == 'popular_fallback'
    personalized_count = 0 if used_fallback else len(package_ids)
    fallback_count = len(package_ids) if used_fallback else 0

    return PackageRecommendationResult(
        package_ids=package_ids,
        strategy=strategy,
        model_version_label=model_version.version_label if model_version else '',
        model_version=model_version,
        results_detail=results_detail,
        used_fallback=used_fallback,
        personalized_count=personalized_count,
        fallback_count=fallback_count,
        behavior_event_count=behavior_event_count,
        behavior_listing_count=behavior_listing_count,
        recommendation_event_count=recommendation_event_count,
        interaction_event_count=interaction_event_count,
        behavior_signal_source=behavior_signal_source,
    )


def _package_source_listing_limit(limit: int) -> int:
    return min(max(limit * 10, 40), settings.RECOMMENDATION_FOR_YOU_CANDIDATES)


def _rank_packages_from_listing_result(
    *,
    listing_result: RecommendationResult,
    max_price,
    limit: int,
) -> list[dict]:
    listing_ids = listing_result.listing_ids
    if not listing_ids:
        return []

    listing_scores = _build_listing_score_map(listing_result.results_detail)
    listing_order_index = {listing_id: idx for idx, listing_id in enumerate(listing_ids)}
    today = date.today()

    packages = Package.objects.filter(
        is_active=True,
        is_bookable=True,
        package_listings__listing_id__in=listing_ids,
        slots__is_active=True,
        slots__start_date__gte=today,
    ).prefetch_related(
        'package_listings',
        'slots',
    ).distinct()

    max_price_value = _coerce_decimal(max_price)
    if max_price_value is not None:
        packages = packages.filter(total_price__lte=max_price_value)

    ranked = []
    for package in packages:
        matched_listing_ids = []
        child_score_sum = 0.0

        for package_listing in package.package_listings.all():
            listing_id = package_listing.listing_id
            if listing_id not in listing_scores:
                continue
            matched_listing_ids.append(listing_id)
            child_score_sum += listing_scores[listing_id]

        if not matched_listing_ids:
            continue

        matched_listing_count = len(matched_listing_ids)
        multiple_match_bonus = max(matched_listing_count - 1, 0) * _PACKAGE_MULTIPLE_MATCH_BONUS
        rating_boost = _package_rating_boost(package)
        popularity_boost = _package_popularity_boost(package)
        availability_boost = _package_availability_boost(package, today=today)
        package_score = (
            child_score_sum
            + multiple_match_bonus
            + rating_boost
            + popularity_boost
            + availability_boost
        )

        ranked.append({
            'package_id': package.pk,
            'score': round(package_score, 6),
            'matched_listing_count': matched_listing_count,
            'matched_listing_ids': sorted(
                matched_listing_ids,
                key=lambda listing_id: listing_order_index.get(listing_id, 10**6),
            ),
        })

    ranked.sort(
        key=lambda item: (
            -item['score'],
            -item['matched_listing_count'],
            item['package_id'],
        ),
    )
    return ranked[:limit]


def _build_listing_score_map(results_detail: list[dict]) -> dict[int, float]:
    scores: dict[int, float] = {}
    for item in results_detail:
        listing_id = item['listing_id']
        distance = item.get('distance')
        if distance is None:
            score = _PACKAGE_FALLBACK_SCORE
        else:
            score = 1.0 / (1.0 + max(float(distance), 0.0))
        scores[listing_id] = score
    return scores


def _package_rating_boost(package: Package) -> float:
    try:
        rating = float(package.rating_average or 0)
    except (TypeError, ValueError):
        rating = 0.0
    normalized = max(0.0, min(rating / 5.0, 1.0))
    return normalized * _PACKAGE_RATING_BOOST_WEIGHT


def _package_popularity_boost(package: Package) -> float:
    booking_count = max(int(package.booking_count or 0), 0)
    normalized = min(log1p(booking_count) / log1p(100), 1.0)
    return normalized * _PACKAGE_POPULARITY_BOOST_WEIGHT


def _package_availability_boost(package: Package, *, today) -> float:
    upcoming_slots = [
        slot for slot in package.slots.all()
        if slot.is_active and slot.start_date >= today
    ]
    if not upcoming_slots:
        return 0.0

    next_slot = min(upcoming_slots, key=lambda slot: slot.start_date)
    days_until_start = (next_slot.start_date - today).days
    if days_until_start <= 30:
        return _PACKAGE_NEAR_TERM_SLOT_BOOST
    return _PACKAGE_NEAR_TERM_SLOT_BOOST / 2


def _get_popular_package_fallback(
    *,
    max_price,
    limit: int,
) -> list[dict]:
    today = date.today()
    packages = Package.objects.filter(
        is_active=True,
        is_bookable=True,
        slots__is_active=True,
        slots__start_date__gte=today,
    ).distinct()

    max_price_value = _coerce_decimal(max_price)
    if max_price_value is not None:
        packages = packages.filter(total_price__lte=max_price_value)

    packages = packages.order_by(
        '-booking_count',
        '-rating_average',
        '-created_at',
        'pk',
    )[:limit]

    return [
        {'package_id': package.pk, 'score': 0.0}
        for package in packages
    ]


def _detail_list_from_ids(listing_ids: list[int]) -> list[dict]:
    return [{'listing_id': listing_id, 'distance': None} for listing_id in listing_ids]


def _normalize_cached_results(cached, limit: int) -> list[dict]:
    truncated = cached[:limit]
    if truncated and isinstance(truncated[0], int):
        return _detail_list_from_ids(truncated)
    return truncated


def _normalize_for_you_cache(cached, limit: int) -> dict:
    if isinstance(cached, dict) and 'strategy' in cached:
        strategy = cached['strategy']
        results = cached.get('results', [])
        behavior_event_count = cached.get('behavior_event_count', 0)
        behavior_listing_count = cached.get('behavior_listing_count', 0)
        recommendation_event_count = cached.get('recommendation_event_count', 0)
        interaction_event_count = cached.get('interaction_event_count', 0)
        behavior_signal_source = cached.get('behavior_signal_source', 'none')
    else:
        strategy = 'preference_based'
        results = cached
        behavior_event_count = 0
        behavior_listing_count = 0
        recommendation_event_count = 0
        interaction_event_count = 0
        behavior_signal_source = 'none'

    normalized_results = _normalize_cached_results(results, limit)
    used_fallback, personalized_count, fallback_count = _derive_fallback_mix(
        strategy=strategy,
        listing_ids=[item['listing_id'] for item in normalized_results],
        results_detail=normalized_results,
    )
    return {
        'strategy': strategy,
        'results': normalized_results,
        'used_fallback': used_fallback,
        'personalized_count': personalized_count,
        'fallback_count': fallback_count,
        'behavior_event_count': behavior_event_count,
        'behavior_listing_count': behavior_listing_count,
        'recommendation_event_count': recommendation_event_count,
        'interaction_event_count': interaction_event_count,
        'behavior_signal_source': behavior_signal_source,
    }


def _similar_cache_key(listing_id: int, version_id: int) -> str:
    return f"reco:similar:v{version_id}:l{listing_id}"


def _for_you_cache_key(
    *,
    user_id: int,
    version_id: int,
    catalog_generation: int,
    preference_generation: int,
    behavior_generation: int,
    limit: int,
) -> str:
    return (
        f"reco:foryou:v{version_id}:cg{catalog_generation}:"
        f"pg{preference_generation}:bg{behavior_generation}:"
        f"u{user_id}:l{limit}"
    )


def _derive_fallback_mix(
    *,
    strategy: str,
    listing_ids: list[int],
    results_detail: list[dict],
) -> tuple[bool, int, int]:
    if strategy == 'popular_fallback':
        return True, 0, len(listing_ids)

    fallback_count = sum(
        1 for item in results_detail
        if item.get('distance') is None
    )
    personalized_count = max(len(listing_ids) - fallback_count, 0)
    return fallback_count > 0, personalized_count, fallback_count


def _get_listing_price_map(listing_ids: list[int]) -> dict[int, object]:
    if not listing_ids:
        return {}
    return dict(
        Listing.objects.filter(pk__in=listing_ids).values_list('pk', 'price_per_person')
    )


def _coerce_decimal(value):
    if value in (None, ''):
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def invalidate_listing_cache(listing_id: int):
    """
    Invalidate the similar-listings cache for a specific listing and nearby listings whose cached results may now be stale.
    """
    model_version = get_active_model_version()
    if not model_version:
        return

    bump_catalog_generation()

    cache_key = _similar_cache_key(listing_id, model_version.pk)
    cache.delete(cache_key)

    try:
        from recommendations.models import ListingFeatureSnapshot
        from pgvector.django import CosineDistance

        snapshot = ListingFeatureSnapshot.objects.filter(
            listing_id=listing_id,
            model_version=model_version,
            vector_type='content',
        ).first()

        if snapshot is None:
            return

        neighbor_ids = list(
            ListingFeatureSnapshot.objects.filter(
                model_version=model_version,
                vector_type='content',
            )
            .exclude(listing_id=listing_id)
            .order_by(CosineDistance('embedding', snapshot.embedding))
            .values_list('listing_id', flat=True)[:20]
        )

        keys_to_delete = [
            _similar_cache_key(neighbor_id, model_version.pk)
            for neighbor_id in neighbor_ids
        ]
        if keys_to_delete:
            cache.delete_many(keys_to_delete)
            logger.debug(
                "Invalidated cache for listing %d + %d neighbors.",
                listing_id,
                len(keys_to_delete),
            )
    except Exception:
        logger.exception(
            "Failed to invalidate neighbor caches for listing %d",
            listing_id,
        )
