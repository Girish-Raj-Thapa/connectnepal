from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.shortcuts import get_list_or_404, get_object_or_404
from django.db import transaction
from django.utils import timezone

from accounts.models import HostDetail
from accounts.permissions import IsHost, IsAdmin
from notifications.constants import NotificationPriority, NotificationType
from notifications.services.notification_realtime_service import send_ws_notification
from notifications.services.notification_service import create_notification
from utils.exceptions import ServiceError, ValidationError
from .models import Listing, ListingImage, ActivitySlot, ListingSchedule, SlotException
from .serializers import (
    ListingCreateSerializer,
    ListingUpdateSerializer,
    ListingReadSerializer,
    ListingListSerializer,
    ListingManageSerializer,
    ListingImageSerializer,
    ListingImageUploadSerializer,
    ActivitySlotSerializer,
    ActivitySlotCreateSerializer,
    ActivitySlotUpdateSerializer,
    ListingScheduleSerializer,
    ListingScheduleWriteSerializer,
    SlotExceptionSerializer,
)
from .permissions import IsListingOwner, CanCreateListing
from .filters import ListingFilter
from .services import listing_service
from .services import slot_service
from .services.slot_generation_service import generate_slots_for_listing
from rest_framework.exceptions import PermissionDenied


def _get_owned_listing(request, pk):
    """Return the Listing if request.user is its host, else raise PermissionDenied."""
    listing = get_object_or_404(Listing, pk=pk)
    if listing.host.user != request.user:
        raise PermissionDenied("You do not own this listing.")
    return listing


def _queue_ws_notification(notification):
    if notification:
        transaction.on_commit(lambda n=notification: send_ws_notification(n))


# PUBLIC VIEW

class ListingListView(generics.ListAPIView):
    """
    GET /api/listings/

    List all public listings with filtering, searching, and pagination.

    Features:
    - Filtering: category, price range, destination, etc.
    - Search: title, description, destination
    - Ordering: price, rating, created_at
    - Pagination: 20 items per page (default from settings)

    Access: Public (no authentication required)

    Note: Only shows active listings that are bookable (public).
    """
    serializer_class = ListingListSerializer
    permission_classes = [AllowAny]

    # Filter Configuration
    filterset_class = ListingFilter
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    # Search Fields
    search_fields = ['title', 'description', 'destination']

    # Ordering Fields 
    ordering_fields = [
        'price_per_person',
        'rating_average',
        'created_at',
        'average_duration_hours',
        'duration_days',
    ]

    ordering = ['-created_at'] # default ordering

    def get_queryset(self):
        """
        Return only active, bookable listings.
        """
        return Listing.objects.public().select_related(
            'host',
            'host__user'
        ).prefetch_related(
            'images'
        )
    

class ListingDetailView(generics.RetrieveAPIView):
    """
    GET /api/listings/{id}/

    Get full details of a specific listing.

    Access: Public
    """
    serializer_class = ListingReadSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Listing.objects.public().select_related(
            'host',
            'host__user'
        ).prefetch_related(
            'images'
        )
    

class ListingBySlugView(generics.RetrieveAPIView):
    """
    GET /api/listings/by-slug/{slug}/

    Get listing details by slug (SEO-friendly URLs).

    Access: Public
    """
    serializer_class = ListingReadSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        return Listing.objects.public().select_related(
            'host',
            'host__user'
        ).prefetch_related(
            'images'
        )
    


# HOST VIEWS: listing crud
class ListingCreateView(generics.CreateAPIView):
    """
    POST /api/listings/host/create/

    Create a new listing (starts hidden: is_bookable=false).

    Access: Authenticated hosts only

    Business Rules:
    - Unverified hosts: max 2 active listings
    - All hosts: must have completed onboarding
    - New listings start hidden (is_bookable=false)
    """
    serializer_class = ListingCreateSerializer
    permission_classes = [IsAuthenticated, IsHost, CanCreateListing]
    throttle_scope = 'listing_creation'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        host_detail = request.user.host_detail

        listing = listing_service.create_listing(
            host=host_detail,
            data=serializer.validated_data
        )

        output_serializer = ListingReadSerializer(
            listing,
            context={'request': request}
        )

        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED
        )


class HostListingDetailView(generics.RetrieveUpdateAPIView):
    """
    GET /api/listings/host/{id}/
    PUT/PATCH /api/listings/host/{id}/

    Retrieve or update a specific listing owned by the authenticated host.

    Access: Authenticated host who owns the listing

    GET: Returns full ListingReadSerializer with all fields for editing.
    PUT/PATCH: Update listing using ListingUpdateSerializer.
    """
    permission_classes = [IsAuthenticated, IsHost, IsListingOwner]

    def get_serializer_class(self):
        """Use different serializers for read vs write operations."""
        if self.request.method == 'GET':
            return ListingReadSerializer
        return ListingUpdateSerializer

    def get_queryset(self):
        return Listing.objects.filter(
            host__user=self.request.user,
            is_active=True 
        ).select_related(
            'host',
            'host__user'
        ).prefetch_related(
            'images'
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        listing = self.get_object()

        serializer = self.get_serializer(
            listing,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)

        updated_listing = listing_service.update_listing(
            listing=listing,
            data=serializer.validated_data
        )

        output_serializer = ListingReadSerializer(
            updated_listing,
            context={'request': request}
        )

        return Response(output_serializer.data)
    

class ListingDeleteView(generics.DestroyAPIView):
    """
    DELETE /api/listings/host/{id}/delete/

    Soft delete a listing.

    Access: Authenticated host who owns the listing
    """
    permission_classes = [IsAuthenticated, IsHost, IsListingOwner]

    def get_queryset(self):
        return Listing.objects.filter(
            host__user=self.request.user,
            is_active=True
        )
    
    def destroy(self, request, *args, **kwargs):
        listing = self.get_object()
        listing_service.soft_delete_listing(listing, actor=request.user)

        return Response(
            {"message": "Listing deleted successfully."},
            status=status.HTTP_200_OK,
        )
    


# HOST VIEWS: Host listings

class HostListingsView(generics.ListAPIView):
    """
    GET /api/listings/host/

    Get all listings owned by the authenticated host.

    Access: Authenticated hosts only

    Query Parameters:
    - is_bookable=true|false (filter by visibility)
    """
    serializer_class = ListingManageSerializer
    permission_classes = [IsAuthenticated, IsHost]
    filterset_class = ListingFilter
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['title', 'destination']
    ordering_fields = ['created_at', 'updated_at', 'price_per_person', 'rating_average']
    ordering = ['-updated_at']

    def get_queryset(self):
        try:
            host_detail = self.request.user.host_detail
        except HostDetail.DoesNotExist:
            return Listing.objects.none()
        
        return listing_service.get_host_listings(
            host=host_detail
        )


class HostLimitsView(APIView):
    """
    GET /api/listings/host/limits/

    Get the current limits for listing creation for the authenticated host.

    Access: Authenticated hosts only
    """
    permission_classes = [IsAuthenticated, IsHost]

    def get(self, request):
        try:
            host_detail = request.user.host_detail
        except HostDetail.DoesNotExist:
            raise ServiceError("Host profile not found.", status_code=400)
        
        limits = listing_service.check_unverified_host_limits(host_detail)

        return Response(limits)
    

# HOST VIEWS: image management

class ListingImageUploadView(APIView):
    """
    POST /api/listings/host/{id}/images/

    Upload an image for a listing.

    Request:
    - Content-Type: multipart/form-data
    - image: File (required)
    - is_primary: bool (optional, default false)
    - caption: string (optional)
    - order: int (optional, default 0)
    """
    permission_classes = [IsAuthenticated, IsHost]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        listing = get_object_or_404(
            Listing.objects.filter(host__user=request.user, is_active=True),
            pk=pk
        )

        serializer = ListingImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        listing_image = listing_service.add_listing_image(
            listing=listing,
            image_file=payload['image'],
            is_primary=payload['is_primary'],
            caption=payload['caption'],
            order=payload['order']
        )

        serializer = ListingImageSerializer(
            listing_image,
            context={'request': request}
        )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )


class ListingImageDeleteView(APIView):
    """
    DELETE /api/listings/host/{listing_id}/images/{image_id}/

    Delete a specific image from a listing.
    """
    permission_classes = [IsAuthenticated, IsHost]

    def delete(self, request, listing_pk, image_pk):
        listing_image = get_object_or_404(
            ListingImage.objects.filter(
                listing_id=listing_pk,
                listing__host__user=request.user,
                listing__is_active=True
            ),
            pk=image_pk
        )

        listing_service.delete_listing_image(listing_image)

        return Response(
            {"message": "Image deleted successfully."},
            status=status.HTTP_200_OK
        )


class ListingImageSetPrimaryView(APIView):
    """
    POST /api/listings/host/{listing_id}/images/{image_id}/set-primary/

    Set an image as the primary image for a listing.
    """
    permission_classes = [IsAuthenticated, IsHost]

    def post(self, request, listing_pk, image_pk):
        listing_image = get_object_or_404(
            ListingImage.objects.filter(
                listing_id=listing_pk,
                listing__host__user=request.user,
                listing__is_active=True
            ),
            pk=image_pk
        )

        updated_image = listing_service.set_primary_image(listing_image)

        serializer = ListingImageSerializer(
            updated_image,
            context={'request': request}
        )

        return Response(serializer.data)


# ===========================================================================
# AVAILABILITY CALENDAR VIEW
# ===========================================================================

class ListingAvailabilityView(APIView):
    """
    GET /api/listings/<pk>/availability/

    Returns per-day availability for the given month.
    Used by the frontend react-day-picker availability calendar.

    Query params:
        year           int       e.g. 2026
        month          int       1–12
        traveller_count int      default 1

    Response: { "2026-04-01": "available" | "conflict" | "unavailable", ... }
    Only days from today onward are included.

    Status meanings:
        available   — at least one slot has net capacity >= traveller_count
                      (net = capacity − confirmed − pending, excluding expired holds)
        conflict    — no slot has net capacity, but at least one slot WOULD have
                      room if pending_payment holds expired (potential false block)
        unavailable — no active slots on that day, or all are fully confirmed-booked
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        listing = get_object_or_404(Listing.objects.public(), pk=pk)

        try:
            year = int(request.query_params["year"])
            month = int(request.query_params["month"])
            traveller_count = int(request.query_params.get("traveller_count", 1))
        except (KeyError, TypeError, ValueError):
            return Response(
                {"detail": "year and month are required integer query parameters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (1 <= month <= 12) or year < 2020 or traveller_count < 1:
            return Response(
                {"detail": "Invalid year, month, or traveller_count."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            listing_service.get_availability_calendar(listing, year, month, traveller_count)
        )


# ===========================================================================
# SLOT VIEWS
# ===========================================================================

class PublicSlotListView(generics.ListAPIView):
    """
    GET /api/listings/<pk>/slots/

    List active slots for a listing (traveller-facing).
    Optionally filter by ?date=YYYY-MM-DD.
    Access: public.
    """
    serializer_class = ActivitySlotSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        listing = get_object_or_404(
            Listing.objects.public(), pk=self.kwargs["pk"]
        )
        qs = ActivitySlot.objects.filter(listing=listing, is_active=True)
        date = self.request.query_params.get("date")
        if date:
            qs = qs.filter(start_date=date)
        return listing_service.annotate_slots_booked_count(qs).order_by("start_date", "start_time")


class HostSlotListCreateView(APIView):
    """
    GET  /api/listings/host/<pk>/slots/  — list all slots (host, incl. inactive)
    POST /api/listings/host/<pk>/slots/  — create a slot
    """
    permission_classes = [IsAuthenticated, IsHost]

    def get(self, request, pk):
        listing = _get_owned_listing(request, pk)
        slots = listing_service.annotate_slots_booked_count(
            ActivitySlot.objects.filter(listing=listing)
        ).order_by("start_date", "start_time")
        return Response(ActivitySlotSerializer(slots, many=True).data)

    def post(self, request, pk):
        listing = _get_owned_listing(request, pk)
        serializer = ActivitySlotCreateSerializer(
            data=request.data,
            context={"request": request, "listing": listing},
        )
        serializer.is_valid(raise_exception=True)
        slot = slot_service.create_slot(listing, serializer.validated_data)
        return Response(ActivitySlotSerializer(slot).data, status=status.HTTP_201_CREATED)


class HostSlotDetailView(APIView):
    """
    PATCH  /api/listings/host/<pk>/slots/<slot_id>/  — update capacity / is_active
    DELETE /api/listings/host/<pk>/slots/<slot_id>/  — delete (or deactivate if active bookings)
    """
    permission_classes = [IsAuthenticated, IsHost]

    def _get_slot(self, request, pk, slot_id):
        listing = _get_owned_listing(request, pk)
        return listing, get_object_or_404(ActivitySlot, pk=slot_id, listing=listing)

    def patch(self, request, pk, slot_id):
        listing, slot = self._get_slot(request, pk, slot_id)
        serializer = ActivitySlotUpdateSerializer(
            data=request.data,
            context={"request": request, "listing": listing},
        )
        serializer.is_valid(raise_exception=True)
        slot = slot_service.update_slot(slot, serializer.validated_data)
        return Response(ActivitySlotSerializer(slot).data)

    def delete(self, request, pk, slot_id):
        _, slot = self._get_slot(request, pk, slot_id)
        result = slot_service.delete_or_deactivate_slot(slot)
        if result["deleted"]:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(
            {
                "detail": "Slot has active bookings; deactivated instead of deleted.",
                "slot": ActivitySlotSerializer(result["slot"]).data,
            },
            status=status.HTTP_200_OK,
        )


# ===========================================================================
# SCHEDULE VIEWS  (host — set it once, slots are auto-generated)
# ===========================================================================

class HostScheduleListCreateView(APIView):
    """
    GET  /api/listings/host/<pk>/schedules/  — list all schedules for a listing
    POST /api/listings/host/<pk>/schedules/  — create a new schedule
    """
    permission_classes = [IsAuthenticated, IsHost]

    def get(self, request, pk):
        listing = _get_owned_listing(request, pk)
        schedules = ListingSchedule.objects.filter(listing=listing).order_by("id")
        return Response(ListingScheduleSerializer(schedules, many=True).data)

    def post(self, request, pk):
        listing = _get_owned_listing(request, pk)
        serializer = ListingScheduleWriteSerializer(
            data=request.data,
            context={"request": request, "listing": listing},
        )
        serializer.is_valid(raise_exception=True)
        schedule = slot_service.create_schedule(listing, serializer.validated_data)
        return Response(ListingScheduleSerializer(schedule).data, status=status.HTTP_201_CREATED)


class HostScheduleDetailView(APIView):
    """
    PATCH  /api/listings/host/<pk>/schedules/<schedule_id>/  — update schedule
    DELETE /api/listings/host/<pk>/schedules/<schedule_id>/  — delete schedule
    """
    permission_classes = [IsAuthenticated, IsHost]

    def _get_schedule(self, request, pk, schedule_id):
        listing = _get_owned_listing(request, pk)
        return listing, get_object_or_404(ListingSchedule, pk=schedule_id, listing=listing)

    def patch(self, request, pk, schedule_id):
        listing, schedule = self._get_schedule(request, pk, schedule_id)
        serializer = ListingScheduleWriteSerializer(
            data=request.data,
            context={"request": request, "listing": listing},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        schedule = slot_service.update_schedule(schedule, serializer.validated_data)
        return Response(ListingScheduleSerializer(schedule).data)

    def delete(self, request, pk, schedule_id):
        _, schedule = self._get_schedule(request, pk, schedule_id)
        schedule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class HostGenerateSlotsView(APIView):
    """
    POST /api/listings/host/<pk>/generate-slots/

    Trigger slot generation for a single listing immediately.
    Useful after creating a new schedule — no need to wait for the nightly job.
    """
    permission_classes = [IsAuthenticated, IsHost]

    def post(self, request, pk):
        listing = _get_owned_listing(request, pk)
        created = generate_slots_for_listing(listing)
        return Response({"slots_created": created})


# ===========================================================================
# SLOT EXCEPTION VIEWS  (host — one-off overrides per date)
# ===========================================================================

class HostSlotExceptionListCreateView(APIView):
    """
    GET  /api/listings/host/<pk>/exceptions/  — list exceptions
    POST /api/listings/host/<pk>/exceptions/  — create exception
    """
    permission_classes = [IsAuthenticated, IsHost]

    def get(self, request, pk):
        listing = _get_owned_listing(request, pk)
        exceptions = SlotException.objects.filter(listing=listing).order_by("date")
        return Response(SlotExceptionSerializer(exceptions, many=True).data)

    def post(self, request, pk):
        listing = _get_owned_listing(request, pk)
        serializer = SlotExceptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        exc = slot_service.create_slot_exception(listing, serializer.validated_data)
        return Response(SlotExceptionSerializer(exc).data, status=status.HTTP_201_CREATED)


class HostSlotExceptionDetailView(APIView):
    """
    PATCH  /api/listings/host/<pk>/exceptions/<exception_id>/  — update exception
    DELETE /api/listings/host/<pk>/exceptions/<exception_id>/  — delete exception
    """
    permission_classes = [IsAuthenticated, IsHost]

    def _get_exception(self, request, pk, exception_id):
        listing = _get_owned_listing(request, pk)
        return get_object_or_404(SlotException, pk=exception_id, listing=listing)

    def patch(self, request, pk, exception_id):
        exc = self._get_exception(request, pk, exception_id)
        serializer = SlotExceptionSerializer(exc, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk, exception_id):
        exc = self._get_exception(request, pk, exception_id)
        exc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# ADMIN VIEWS
# ===========================================================================

class AdminListingDeactivateView(APIView):
    """
    POST /api/listings/admin/<pk>/deactivate/

    Forcibly deactivates a listing and removes it from public booking.
    Sets is_active=False and is_bookable=False.
    Only callable by admin.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        with transaction.atomic():
            listing = get_object_or_404(Listing.objects.select_for_update(), pk=pk)
            status_changed = listing.is_active or listing.is_bookable

            listing_service.soft_delete_listing(listing, actor=request.user)

            if status_changed:
                notification = create_notification(
                    recipient=listing.host.user,
                    actor=request.user,
                    notification_type=NotificationType.LISTING_DEACTIVATED,
                    title="Listing Deactivated",
                    body=(
                        f'Your listing "{listing.title}" was deactivated by the '
                        "admin team."
                    ),
                    action_url=f"/host/listings/{listing.pk}/edit",
                    metadata={"listing_id": listing.pk},
                    priority=NotificationPriority.HIGH,
                )
                _queue_ws_notification(notification)

        return Response({"detail": f"Listing {pk} has been deactivated."})


class AdminListingActivateView(APIView):
    """
    POST /api/listings/admin/<pk>/activate/

    Re-activates a listing so the host can manage it again.
    Sets is_active=True. is_bookable is left as-is — the host controls that.
    Only callable by admin.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        with transaction.atomic():
            listing = get_object_or_404(Listing.objects.select_for_update(), pk=pk)
            status_changed = not listing.is_active

            listing.is_active = True
            listing.save(update_fields=["is_active"])

            if status_changed:
                notification = create_notification(
                    recipient=listing.host.user,
                    actor=request.user,
                    notification_type=NotificationType.LISTING_ACTIVATED,
                    title="Listing Activated",
                    body=(
                        f'Your listing "{listing.title}" was activated and can be '
                        "managed again."
                    ),
                    action_url=f"/host/listings/{listing.pk}/edit",
                    metadata={"listing_id": listing.pk},
                    priority=NotificationPriority.NORMAL,
                )
                _queue_ws_notification(notification)

        return Response({"detail": f"Listing {pk} has been activated."})
