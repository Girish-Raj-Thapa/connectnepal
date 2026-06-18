from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from django.db.models import Q

from accounts.models import HostDetail
from accounts.permissions import IsTraveller, IsHost, IsAdmin
from .permissions import IsBookingOwner, IsBookingItemHostOwner
from .serializers import (
    BookingQuoteSerializer, BookingQuoteResponseSerializer,
    BookingCreateSerializer, BookingCreateResponseSerializer,
    BookingFromTripPlanSerializer,
    BookingDetailSerializer, BookingListSerializer,
    BookingCancelSerializer, BookingCancelResponseSerializer,
    HostBookingItemListSerializer, HostBookingItemDetailSerializer,
    HostBookingItemMarkCompletedSerializer,
    AdminBookingListSerializer, AdminBookingDetailSerializer,
    AdminBookingCancelSerializer,
)
from .filters import BookingFilter, HostBookingItemFilter, AdminBookingFilter
from .models import Booking, BookingItem, CancellationReason
from .services.booking_service import (
    quote_booking, create_booking, cancel_booking,
    host_mark_completed, create_booking_from_trip_plan,
    create_package_booking,
)
from utils.pagination import EightPerPagePagination


# ============================================================================
# TRAVELLER VIEWS
# ============================================================================

class BookingQuoteView(APIView):
    """
    Compute per-item pricing and availability without any database write.
    Use this to show the traveller a cost breakdown before confirming a booking.
    Each item includes an availability field: 'available', 'conflict', or 'unavailable'.
    """
    serializer_class = BookingQuoteSerializer
    permission_classes = [IsAuthenticated, IsTraveller]

    def post(self, request):
        serializer = BookingQuoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = quote_booking(request.user, serializer.validated_data)
        out = BookingQuoteResponseSerializer(result)
        return Response(out.data)


class BookingListCreateView(generics.ListCreateAPIView):
    """
    GET: Returns the authenticated traveller's bookings, newest first.
    Supports filtering by status, source, date_from, and date_to.
    Paginated at 8 per page (?page=2 for next page).

    POST: Creates a multi-item booking with per-item availability holds.
    Pass an Idempotency-Key header to safely retry — returns HTTP 200 for a
    replay, HTTP 201 for a new booking.
    """
    permission_classes = [IsAuthenticated, IsTraveller]
    filter_backends = [DjangoFilterBackend]
    filterset_class = BookingFilter
    pagination_class = EightPerPagePagination

    def get_queryset(self):
        from django.db.models import Count
        return (
            Booking.objects
            .filter(traveller=self.request.user)
            .annotate(item_count=Count("items"))
            .prefetch_related("items")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return BookingCreateSerializer
        return BookingListSerializer

    def create(self, request, *args, **kwargs):
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        idempotency_key = request.headers.get("Idempotency-Key", "")

        # XOR routing: the serializer guarantees exactly one path is present.
        if "package_id" in serializer.validated_data:
            booking, created = create_package_booking(
                user=request.user,
                package_id=serializer.validated_data["package_id"],
                traveller_count=serializer.validated_data["traveller_count"],
                idempotency_key=idempotency_key,
                package_slot_id=serializer.validated_data.get("package_slot_id"),
            )
        else:
            booking, created = create_booking(
                request.user, serializer.validated_data, idempotency_key
            )

        booking = Booking.objects.prefetch_related("items__listing").get(pk=booking.pk)
        out = BookingCreateResponseSerializer(booking)

        http_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(out.data, status=http_status)


class BookingDetailView(generics.RetrieveAPIView):
    """
    Returns full details of a single booking including all line items,
    pricing breakdown, payment status, and status history.
    Returns 404 (not 403) if the booking belongs to another traveller.
    """
    serializer_class = BookingDetailSerializer
    permission_classes = [IsAuthenticated, IsTraveller, IsBookingOwner]

    def get_queryset(self):
        return Booking.objects.filter(traveller=self.request.user).prefetch_related(
            "items__listing",
            "items__history",
            "items__review",
            "history",
        )


class BookingCancelView(APIView):
    """
    Cancel a booking. Travellers can only cancel bookings in pending_payment status.
    Admins can cancel any non-terminal booking.
    Cancelling releases all availability holds immediately.
    """
    serializer_class = BookingCancelSerializer
    permission_classes = [IsAuthenticated, IsTraveller]

    def post(self, request, pk):
        serializer = BookingCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = cancel_booking(
            user=request.user,
            booking_id=pk,
            reason=serializer.validated_data["reason"],
            note=serializer.validated_data.get("note", ""),
        )
        out = BookingCancelResponseSerializer(booking)
        return Response(out.data)


class BookingFromTripPlanView(APIView):
    """
    Convert selected items from a trip plan into a booking.
    The trip plan must be in 'planning' status.
    Each item maps to a TripPlannerItem — listing and duration_type are resolved
    automatically from the plan item snapshot; supply only dates and traveller_count.
    Supports Idempotency-Key header with the same semantics as POST /api/bookings/.
    """
    serializer_class = BookingFromTripPlanSerializer
    permission_classes = [IsAuthenticated, IsTraveller]

    def post(self, request, plan_id):
        serializer = BookingFromTripPlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        idempotency_key = request.headers.get("Idempotency-Key", "")
        booking, created = create_booking_from_trip_plan(
            user=request.user,
            plan_id=plan_id,
            items_data=serializer.validated_data["items"],
            idempotency_key=idempotency_key,
        )
        booking = Booking.objects.prefetch_related("items__listing").get(pk=booking.pk)
        out = BookingCreateResponseSerializer(booking)
        http_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(out.data, status=http_status)


# ============================================================================
# HOST VIEWS (operate on BookingItem)
# ============================================================================

class HostBookingItemListView(generics.ListAPIView):
    """
    Returns all BookingItems for listings or packages owned by the authenticated
    host, newest first.
    Supports filtering by status, listing_id, package_id, duration_type,
    date_from, and date_to.
    Paginated at 8 per page (?page=2 for next page).
    """
    serializer_class = HostBookingItemListSerializer
    permission_classes = [IsAuthenticated, IsHost]
    filter_backends = [DjangoFilterBackend]
    filterset_class = HostBookingItemFilter
    pagination_class = EightPerPagePagination

    def get_queryset(self):
        try:
            host_detail = self.request.user.host_detail
        except HostDetail.DoesNotExist:
            return BookingItem.objects.none()

        return (
            BookingItem.objects
            .filter(Q(listing__host=host_detail) | Q(package__host=host_detail))
            .filter(booking__confirmed_at__isnull=False)
            .select_related("booking__traveller", "listing", "package")
            .order_by("-created_at")
        )


class HostBookingItemDetailView(generics.RetrieveAPIView):
    """
    Returns full details of a single BookingItem belonging to the host's listing
    or package.
    Includes traveller info, full pricing breakdown, snapshot data, and status
    history.
    Returns 404 (not 403) if the item belongs to another host.
    """
    serializer_class = HostBookingItemDetailSerializer
    permission_classes = [IsAuthenticated, IsHost, IsBookingItemHostOwner]
    lookup_url_kwarg = "item_id"

    def get_queryset(self):
        try:
            host_detail = self.request.user.host_detail
        except HostDetail.DoesNotExist:
            return BookingItem.objects.none()

        return (
            BookingItem.objects
            .filter(Q(listing__host=host_detail) | Q(package__host=host_detail))
            .filter(booking__confirmed_at__isnull=False)
            .select_related("booking__traveller", "listing", "package")
            .prefetch_related("history")
        )

@extend_schema(request=None, responses={200: HostBookingItemMarkCompletedSerializer})
class HostBookingItemMarkCompletedView(APIView):
    """
    Mark a BookingItem as completed once the experience has been delivered.
    The item must be in confirmed status and the scheduled experience must
    already have ended.

    Timing rules:
    - hourly items: only after end_date + end_time
    - full_day and multi_day items: only after the booked end_date has elapsed

    If this is the last confirmed item in the booking, the parent Booking is
    automatically marked completed as well.
    """
    permission_classes = [IsAuthenticated, IsHost]

    def post(self, request, item_id):
        item = host_mark_completed(request.user, item_id)
        out = HostBookingItemMarkCompletedSerializer(item)
        return Response(out.data)


# ============================================================================
# ADMIN VIEWS
# ============================================================================

class AdminBookingListView(generics.ListAPIView):
    """
    GET /api/admin/bookings/
    GET /api/admin/bookings/?status=confirmed&search=john@example.com

    Lists all bookings platform-wide with filtering and pagination.
    """
    serializer_class = AdminBookingListSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_class = AdminBookingFilter
    pagination_class = EightPerPagePagination

    def get_queryset(self):
        from django.db.models import Count
        return (
            Booking.objects
            .annotate(item_count=Count("items"))
            .select_related("traveller")
            .order_by("-created_at")
        )


class AdminBookingDetailView(generics.RetrieveAPIView):
    """
    GET /api/admin/bookings/<id>/

    Returns full booking detail with items, traveller info,
    payment info, and status history.
    """
    serializer_class = AdminBookingDetailSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        return (
            Booking.objects
            .select_related("traveller", "cancelled_by")
            .prefetch_related(
                "items__listing",
                "items__package",
                "items__history",
                "items__review",
                "history",
            )
        )


class AdminBookingCancelView(APIView):
    """
    POST /api/admin/bookings/<id>/cancel/

    Admin cancels any non-terminal booking. Uses ADMIN_ACTION reason.
    Delegates to the existing cancel_booking() service function.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        serializer = AdminBookingCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        booking = cancel_booking(
            user=request.user,
            booking_id=pk,
            reason=CancellationReason.ADMIN_ACTION,
            note=serializer.validated_data.get("note", ""),
        )

        return Response(
            AdminBookingDetailSerializer(booking).data,
            status=status.HTTP_200_OK,
        )
