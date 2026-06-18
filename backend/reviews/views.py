from django.shortcuts import get_object_or_404
from django.db import models as django_models
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from accounts.permissions import IsTraveller, IsHost, IsAdmin
from utils.pagination import EightPerPagePagination, ReviewPagination
from .models import Review, ReviewReport, ReviewStatus, HostReplyStatus
from .permissions import IsReviewOwner, IsReviewTargetOwner
from .serializers import (
    ReviewCreateSerializer,
    ReviewEditSerializer,
    ReviewReadSerializer,
    ReviewListSerializer,
    HostReplySerializer,
    ReviewReportCreateSerializer,
    ReviewReportReadSerializer,
    ReviewModerateSerializer,
    HostReplyModerateSerializer,
)
from .services.reviews_service import (
    create_review,
    update_review,
    soft_delete_review,
    save_host_reply,
    report_review,
    report_host_reply,
    moderate_review,
    moderate_host_reply,
)


# TRAVELLER VIEWS

class ReviewListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/reviews/  — list the authenticated traveller's own reviews (all statuses).
    
    POST /api/reviews/  — create a new review.
    """
    permission_classes = [IsAuthenticated, IsTraveller]
    pagination_class = EightPerPagePagination

    def get_queryset(self):
        return (
            Review.objects
            .filter(traveller=self.request.user)
            .select_related('listing', 'package', 'traveller', 'booking_item')
        )

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ReviewCreateSerializer
        return ReviewReadSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = create_review(request.user, serializer.validated_data)
        output = ReviewReadSerializer(review, context={'request': request})
        return Response(output.data, status=status.HTTP_201_CREATED)


class ReviewDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/reviews/{id}/ — retrieve single review (mixed visibility).

    PUT    /api/reviews/{id}/ — edit own review.

    PATCH  /api/reviews/{id}/ — edit own review (partial).

    DELETE /api/reviews/{id}/ — soft-delete own review.
    """
    serializer_class = ReviewReadSerializer
    queryset = Review.objects.select_related('listing', 'package', 'traveller', 'booking_item')

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsAuthenticated(), IsReviewOwner()]
        return [AllowAny()]

    def _is_publicly_visible(self, review):
        if review.status != ReviewStatus.PUBLISHED or not review.traveller.is_active:
            return False

        if review.listing_id and review.listing:
            return (
                review.listing.is_active
                and review.listing.is_bookable
                and review.listing.host.user.is_active
            )

        if review.package_id and review.package:
            from packages.models import Package

            return (
                review.package.is_active
                and review.package.is_bookable
                and review.package.host.user.is_active
                and Package.objects.public_ready().filter(pk=review.package_id).exists()
            )

        return False

    def get_object(self):
        obj = super().get_object()
        # For GET: public can see published; owner can see any status; others get 404
        if self.request.method == 'GET':
            if self._is_publicly_visible(obj):
                return obj
            if self.request.user.is_authenticated and obj.traveller_id == self.request.user.id:
                return obj
            # Check if host of the reviewed item
            if self.request.user.is_authenticated and hasattr(self.request.user, 'host_detail'):
                host = self.request.user.host_detail
                if (obj.listing and obj.listing.host == host) or \
                   (obj.package and obj.package.host == host):
                    return obj
            from django.http import Http404
            raise Http404
        return obj

    def update(self, request, *args, **kwargs):
        review = self.get_object()
        serializer = ReviewEditSerializer(
            data=request.data,
            context={'request': request, 'review': review},
        )
        serializer.is_valid(raise_exception=True)
        updated = update_review(review, serializer.validated_data, request.user)
        output = ReviewReadSerializer(updated, context={'request': request})
        return Response(output.data)

    def perform_destroy(self, instance):
        soft_delete_review(instance, self.request.user)


# PUBLIC NESTED VIEWS

class ListingReviewsView(generics.ListAPIView):
    """
    GET /api/listings/{listing_pk}/reviews/

    Public. Returns only published reviews, newest first.
    Supports ?page_size=N and ?page=N for "load more" pagination.
    """
    serializer_class = ReviewReadSerializer
    permission_classes = [AllowAny]
    pagination_class = ReviewPagination

    def get_queryset(self):
        return (
            Review.objects
            .filter(
                listing_id=self.kwargs['listing_pk'],
                status=ReviewStatus.PUBLISHED,
                listing__is_active=True,
                listing__is_bookable=True,
                listing__host__user__is_active=True,
                traveller__is_active=True,
            )
            .select_related('traveller')
            .order_by('-created_at')
        )


class PackageReviewsView(generics.ListAPIView):
    """
    GET /api/packages/{package_pk}/reviews/

    Public. Returns only published reviews, newest first.
    Supports ?page_size=N and ?page=N for "load more" pagination.
    """
    serializer_class = ReviewReadSerializer
    permission_classes = [AllowAny]
    pagination_class = ReviewPagination

    def get_queryset(self):
        from packages.models import Package

        return (
            Review.objects
            .filter(
                package_id=self.kwargs['package_pk'],
                status=ReviewStatus.PUBLISHED,
                package__is_active=True,
                package__is_bookable=True,
                package__host__user__is_active=True,
                traveller__is_active=True,
                package__in=Package.objects.public_ready(),
            )
            .select_related('traveller')
            .order_by('-created_at')
        )


# HOST VIEWS

class HostReviewListView(generics.ListAPIView):
    """
    GET /api/host/reviews/

    Returns reviews on host-owned listings/packages.

    Shows published and under_review. Excludes user_deleted.
    """
    serializer_class = ReviewListSerializer
    permission_classes = [IsAuthenticated, IsHost]
    pagination_class = EightPerPagePagination

    def get_queryset(self):
        host = self.request.user.host_detail
        return (
            Review.objects
            .filter(
                django_models.Q(listing__host=host) |
                django_models.Q(package__host=host),
            )
            .exclude(status=ReviewStatus.USER_DELETED)
            .select_related('traveller', 'listing', 'package', 'booking_item')
            .prefetch_related('reports')
        )


class HostReviewReplyView(APIView):
    """
    POST /api/host/reviews/{pk}/reply/

    Host posts or overwrites their reply. Review must be published.
    """
    permission_classes = [IsAuthenticated, IsHost, IsReviewTargetOwner]

    def post(self, request, pk):
        review = get_object_or_404(Review, pk=pk)
        self.check_object_permissions(request, review)

        serializer = HostReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_review = save_host_reply(
            review,
            serializer.validated_data['reply'],
            actor=request.user,
        )

        output = ReviewReadSerializer(updated_review, context={'request': request})
        return Response(output.data)


# REPORTING VIEWS

class ReviewReportView(APIView):
    """
    POST /api/reviews/{pk}/report/

    Host reports a traveller review on their listing/package.
    """
    permission_classes = [IsAuthenticated, IsHost, IsReviewTargetOwner]

    def post(self, request, pk):
        review = get_object_or_404(Review, pk=pk)
        self.check_object_permissions(request, review)

        serializer = ReviewReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        report_review(
            review=review,
            reporter=request.user,
            reason=serializer.validated_data['reason'],
            details=serializer.validated_data.get('details', ''),
        )

        return Response(
            {"message": "Report submitted successfully."},
            status=status.HTTP_201_CREATED,
        )


class HostReplyReportView(APIView):
    """
    POST /api/host/reviews/{pk}/reply/report/

    Traveller reports an abusive host reply on their own review.
    """
    permission_classes = [IsAuthenticated, IsTraveller, IsReviewOwner]

    def post(self, request, pk):
        review = get_object_or_404(Review, pk=pk)
        self.check_object_permissions(request, review)

        serializer = ReviewReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        report_host_reply(
            review=review,
            reporter=request.user,
            reason=serializer.validated_data['reason'],
            details=serializer.validated_data.get('details', ''),
        )

        return Response(
            {"message": "Report submitted successfully."},
            status=status.HTTP_201_CREATED,
        )


# ADMIN MODERATION VIEWS

class AdminReviewReportListView(generics.ListAPIView):
    """
    GET /api/admin/review-reports/

    Moderation queue. Supports filtering by status, target_type, reason.
    """
    serializer_class = ReviewReportReadSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = EightPerPagePagination

    def get_queryset(self):
        qs = ReviewReport.objects.select_related(
            'review', 'reporter', 'resolved_by',
        ).order_by('-created_at')

        # Optional filters
        report_status = self.request.query_params.get('status')
        if report_status:
            qs = qs.filter(status=report_status)

        target_type = self.request.query_params.get('target_type')
        if target_type:
            qs = qs.filter(target_type=target_type)

        reason = self.request.query_params.get('reason')
        if reason:
            qs = qs.filter(reason=reason)

        return qs


class AdminReviewModerateView(APIView):
    """
    POST /api/admin/reviews/{pk}/moderate/

    Admin changes review status.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        review = get_object_or_404(
            Review.objects.select_related('listing', 'package'),
            pk=pk,
        )

        serializer = ReviewModerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = moderate_review(
            review=review,
            action=serializer.validated_data['action'],
            admin_user=request.user,
            note=serializer.validated_data.get('note', ''),
        )

        output = ReviewReadSerializer(updated, context={'request': request})
        return Response(output.data)


class AdminReplyModerateView(APIView):
    """
    POST /api/admin/reviews/{pk}/reply/moderate/
    
    Admin keeps or removes host reply.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        review = get_object_or_404(
            Review.objects.select_related('listing', 'package'),
            pk=pk,
        )

        serializer = HostReplyModerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = moderate_host_reply(
            review=review,
            action=serializer.validated_data['action'],
            admin_user=request.user,
            note=serializer.validated_data.get('note', ''),
        )

        output = ReviewReadSerializer(updated, context={'request': request})
        return Response(output.data)
