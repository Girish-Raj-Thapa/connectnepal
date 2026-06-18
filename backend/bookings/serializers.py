from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers
from .models import (
    Booking, BookingItem, AvailabilityHold,
    BookingStatusHistory, BookingStatus, BookingItemStatus,
    CancellationReason,
)

#===========================================================================
# INPUT SERIALIZERS (validation only — service layer does business logic)
#===========================================================================

class BookingItemInputSerializer(serializers.Serializer):
    """
    Validates a single item line in quote / create requests.

    Schedules are now slot-based: the user picks a slot_id and the service
    derives all date/time fields from the ActivitySlot.
    """
    listing_id      = serializers.IntegerField(min_value=1)
    slot_id         = serializers.IntegerField(min_value=1)
    traveller_count = serializers.IntegerField(min_value=1)
    trip_plan_item_id = serializers.IntegerField(required=False, allow_null=True)


class BookingQuoteSerializer(serializers.Serializer):
    """
    Input for POST /api/bookings/quote/
    """
    trip_plan_id = serializers.IntegerField(required=False, allow_null=True)
    items = BookingItemInputSerializer(many=True, min_length=1)


class BookingCreateSerializer(serializers.Serializer):
    """
    Input for POST /api/bookings/

    Accepts either a listing-based booking (``items`` array) or a package
    booking (``package_id`` + ``traveller_count``).  Exactly one of the two
    paths must be present — both or neither raise a validation error.

    Idempotency is controlled via the Idempotency-Key HTTP header only —
    do NOT put it in the request body to avoid ambiguity.
    """

    # Listing-based path
    trip_plan_id = serializers.IntegerField(required=False, allow_null=True)
    items = BookingItemInputSerializer(many=True, required=False)

    # Package-based path
    package_id = serializers.IntegerField(min_value=1, required=False)
    traveller_count = serializers.IntegerField(min_value=1, required=False)
    package_slot_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)

    def validate(self, attrs):
        has_items = bool(attrs.get("items"))
        has_package = "package_id" in attrs

        if has_items and has_package:
            raise serializers.ValidationError(
                "Provide either 'items' or 'package_id', not both.",
                code="xor_required",
            )
        if not has_items and not has_package:
            raise serializers.ValidationError(
                "Provide either 'items' (listing booking) or 'package_id' (package booking).",
                code="xor_required",
            )
        if has_package and not attrs.get("traveller_count"):
            raise serializers.ValidationError(
                {"traveller_count": "traveller_count is required for package bookings."},
            )
        if attrs.get("package_slot_id") and not has_package:
            raise serializers.ValidationError(
                {"package_slot_id": "package_slot_id can only be used with package_id."},
            )
        return attrs


class BookingFromTripPlanItemSerializer(serializers.Serializer):
    """
    One item from a trip plan conversion.
    The user picks which slot to book for each trip plan item.
    """
    trip_plan_item_id = serializers.IntegerField(min_value=1)
    slot_id           = serializers.IntegerField(min_value=1)
    traveller_count   = serializers.IntegerField(min_value=1)


class BookingFromTripPlanSerializer(serializers.Serializer):
    """
    Input for POST /api/bookings/from-trip-plan/<plan_id>/
    """
    items = BookingFromTripPlanItemSerializer(many=True, min_length=1)


class BookingCancelSerializer(serializers.Serializer):
    """
    Input for POST /api/bookings/<id>/cancel/
    """
    reason = serializers.ChoiceField(choices=CancellationReason.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)


#===========================================================================
# NESTED OUTPUT SERIALIZERS
#===========================================================================

class BookingStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_email = serializers.SerializerMethodField()

    class Meta:
        model  = BookingStatusHistory
        fields = [
            "id", "booking_item_id", "from_status", "to_status",
            "note", "changed_by_email", "changed_at",
        ]

    def get_changed_by_email(self, obj):
        return obj.changed_by.email if obj.changed_by else None


class BookingItemTargetSerializerMixin:
    def _get_snapshot(self, obj):
        return obj.snapshot if isinstance(obj.snapshot, dict) else {}

    def get_target_type(self, obj):
        return "package" if obj.package_id else "listing"

    def get_title(self, obj):
        return self.get_package_title(obj) if obj.package_id else self.get_listing_title(obj)

    def get_listing_title(self, obj):
        if not obj.listing_id:
            return None
        snapshot = self._get_snapshot(obj)
        return snapshot.get("title") or (obj.listing.title if obj.listing else None)

    def get_package_title(self, obj):
        if not obj.package_id:
            return None
        snapshot = self._get_snapshot(obj)
        return snapshot.get("package_title") or (obj.package.title if obj.package else None)


class BookingItemListSerializer(BookingItemTargetSerializerMixin, serializers.ModelSerializer):
    """
    Compact item representation for embedding in booking list/detail.
    """
    target_type = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    listing_title = serializers.SerializerMethodField()
    package_title = serializers.SerializerMethodField()

    class Meta:
        model  = BookingItem
        fields = [
            "id", "target_type", "title",
            "listing_id", "listing_title",
            "package_id", "package_title",
            "duration_type", "start_date", "end_date",
            "start_time", "end_time", "days", "nights",
            "traveller_count", "status",
            "quoted_total", "currency",
        ]


class BookingItemDetailSerializer(BookingItemTargetSerializerMixin, serializers.ModelSerializer):
    """
    Full item output for traveller detail view.
    Includes review-state fields for tracking review eligibility.
    """
    target_type = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    listing_title = serializers.SerializerMethodField()
    package_title = serializers.SerializerMethodField()
    history = BookingStatusHistorySerializer(many=True, read_only=True)
    review_id = serializers.SerializerMethodField()
    has_review = serializers.SerializerMethodField()
    review_status = serializers.SerializerMethodField()
    can_review = serializers.SerializerMethodField()
    cannot_review_reason = serializers.SerializerMethodField()

    class Meta:
        model  = BookingItem
        fields = [
            "id", "target_type", "title",
            "listing_id", "listing_title",
            "package_id", "package_title",
            "duration_type", "start_date", "end_date",
            "start_time", "end_time", "days", "nights",
            "traveller_count", "status",
            "snapshot",
            "price_per_person", "subtotal", "discount_amount",
            "fee_amount", "tax_amount", "gross_amount",
            "quoted_total", "currency",
            "created_at", "updated_at", "completed_at",
            "review_id", "has_review", "review_status", "can_review", "cannot_review_reason",
            "history",
        ]

    def _get_visible_review(self, obj):
        from reviews.models import ReviewStatus

        if not hasattr(obj, 'review') or obj.review is None:
            return None
        if obj.review.status == ReviewStatus.USER_DELETED:
            return None
        return obj.review

    def get_review_id(self, obj):
        """Return the review ID if a review exists for this booking item."""
        review = self._get_visible_review(obj)
        return review.id if review else None

    def get_has_review(self, obj):
        """Check if a review exists for this booking item."""
        return self._get_visible_review(obj) is not None

    def get_review_status(self, obj):
        """Return the review status if a review exists."""
        review = self._get_visible_review(obj)
        return review.status if review else None

    def get_can_review(self, obj):
        """Check if a review can be created for this booking item."""
        from reviews.services.reviews_service import get_review_eligibility
        can_review, _ = get_review_eligibility(obj)
        return can_review

    def get_cannot_review_reason(self, obj):
        """Return reason why review cannot be created, or None if it can."""
        from reviews.services.reviews_service import get_review_eligibility
        _, reason = get_review_eligibility(obj)
        return reason


#===========================================================================
# BOOKING OUTPUT SERIALIZERS (traveller-facing)
#===========================================================================

class BookingListSerializer(serializers.ModelSerializer):
    """
    Compact booking for list view.

    item_count comes from an annotation added in get_queryset(), not a
    per-row sub-query — avoids N+1 extra COUNT queries.
    """
    item_count = serializers.IntegerField(read_only=True)  # annotated in view

    class Meta:
        model  = Booking
        fields = [
            "id", "reference", "status", "payment_status",
            "item_count", "quoted_total", "paid_amount",
            "currency", "source", "created_at",
        ]


class BookingDetailSerializer(serializers.ModelSerializer):
    """
    Full booking detail with nested items and history.
    """
    items = BookingItemDetailSerializer(many=True, read_only=True)
    history = BookingStatusHistorySerializer(many=True, read_only=True)

    class Meta:
        model  = Booking
        fields = [
            "id", "reference", "status", "payment_status",
            "payment_provider", "transaction_id",
            "expires_at", "paid_at", "paid_amount",
            "subtotal", "discount_amount", "fee_amount",
            "tax_amount", "gross_amount", "quoted_total", "currency",
            "source", "trip_plan_id",
            "cancelled_at", "cancellation_reason", "cancellation_note",
            "items", "history",
            "created_at", "updated_at",
        ]


class BookingCreateResponseSerializer(serializers.ModelSerializer):
    """
    Response after POST /api/bookings/ or /from-trip-plan/.
    """
    items = BookingItemListSerializer(many=True, read_only=True)

    class Meta:
        model  = Booking
        fields = [
            "id", "reference", "status",
            "expires_at", "quoted_total", "currency",
            "source", "trip_plan_id", "items", "created_at",
        ]


class BookingCancelResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Booking
        fields = ["id", "reference", "status", "cancelled_at", "cancellation_reason"]


#===========================================================================
# HOST-FACING SERIALIZERS (operate on BookingItem)
#===========================================================================

class HostBookingItemTargetMixin:
    def get_target_type(self, obj):
        if obj.package_id:
            return "package"
        return "listing"

    def get_target_id(self, obj):
        if obj.package_id:
            return obj.package_id
        return obj.listing_id

    def get_title(self, obj):
        if obj.package_id:
            return self.get_package_title(obj)
        if obj.listing_id:
            return self.get_listing_title(obj)
        return None

    def get_listing_title(self, obj):
        if obj.listing_id:
            snapshot = obj.snapshot if isinstance(obj.snapshot, dict) else {}
            return snapshot.get("title") or (obj.listing.title if obj.listing else None)
        return None

    def get_package_title(self, obj):
        if obj.package_id:
            snapshot = obj.snapshot if isinstance(obj.snapshot, dict) else {}
            return snapshot.get("package_title") or (obj.package.title if obj.package else None)
        return None

    def get_traveller_name(self, obj):
        traveller = obj.booking.traveller
        return traveller.full_name if traveller else None

    def get_traveller_email(self, obj):
        traveller = obj.booking.traveller
        return traveller.email if traveller else None


class HostBookingItemListSerializer(HostBookingItemTargetMixin, serializers.ModelSerializer):
    """
    Compact item for host inbox list.
    """
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)
    target_type = serializers.SerializerMethodField()
    target_id = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    listing_title = serializers.SerializerMethodField()
    package_title = serializers.SerializerMethodField()
    traveller_name = serializers.SerializerMethodField()

    class Meta:
        model = BookingItem
        fields = [
            "id", "booking_reference", "booking_id",
            "target_type", "target_id", "title",
            "listing_id", "listing_title",
            "package_id", "package_title",
            "duration_type", "start_date", "end_date",
            "traveller_count", "traveller_name", "status",
            "quoted_total", "currency", "created_at",
        ]


class HostBookingItemDetailSerializer(HostBookingItemTargetMixin, serializers.ModelSerializer):
    """
    Full item detail for host — includes traveller info.
    """
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)
    target_type = serializers.SerializerMethodField()
    target_id = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    listing_title = serializers.SerializerMethodField()
    package_title = serializers.SerializerMethodField()
    traveller_name = serializers.SerializerMethodField()
    traveller_email = serializers.SerializerMethodField()
    history = BookingStatusHistorySerializer(many=True, read_only=True)

    class Meta:
        model = BookingItem
        fields = [
            "id", "booking_reference", "booking_id",
            "target_type", "target_id", "title",
            "listing_id", "listing_title",
            "package_id", "package_title",
            "duration_type", "start_date", "end_date",
            "start_time", "end_time", "days", "nights",
            "traveller_count", "traveller_name", "traveller_email",
            "status", "snapshot",
            "price_per_person", "subtotal", "discount_amount",
            "fee_amount", "tax_amount", "gross_amount",
            "quoted_total", "currency",
            "created_at", "updated_at", "completed_at",
            "history",
        ]


class HostBookingItemMarkCompletedSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingItem
        fields = ["id", "status", "completed_at"]

#===========================================================================
# QUOTE OUTPUT SERIALIZERS
#===========================================================================

class BookingItemQuoteSerializer(serializers.Serializer):
    """
    Per-item quote result.
    """
    listing_id = serializers.IntegerField()
    listing_title = serializers.CharField()
    duration_type = serializers.CharField()
    start_date = serializers.DateField(allow_null=True)
    end_date = serializers.DateField(allow_null=True)
    days = serializers.IntegerField()
    traveller_count = serializers.IntegerField()
    price_per_person = serializers.DecimalField(max_digits=10, decimal_places=2)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    fee_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    tax_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    gross_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    quoted_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    availability = serializers.ChoiceField(choices=["available", "conflict", "unavailable"])
    currency = serializers.CharField()


class BookingTotalsSerializer(serializers.Serializer):
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    fee_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    tax_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    gross_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    quoted_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField()


class BookingQuoteResponseSerializer(serializers.Serializer):
    items = BookingItemQuoteSerializer(many=True)
    totals = BookingTotalsSerializer()


# ============================================================================
# ADMIN SERIALIZERS
# ============================================================================

class AdminBookingListSerializer(serializers.ModelSerializer):
    """Compact booking for admin list view. Includes traveller info."""
    item_count = serializers.IntegerField(read_only=True)  # annotated in view
    traveller_email = serializers.CharField(
        source="traveller.email", read_only=True, default=None,
    )
    traveller_name = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id", "reference", "status", "payment_status",
            "traveller_id", "traveller_email", "traveller_name",
            "item_count", "quoted_total", "paid_amount",
            "currency", "source", "created_at",
        ]

    def get_traveller_name(self, obj):
        if obj.traveller:
            return obj.traveller.full_name
        return None


class AdminBookingDetailSerializer(serializers.ModelSerializer):
    """Full booking detail for admin. Includes items, history, and traveller info."""
    items = BookingItemDetailSerializer(many=True, read_only=True)
    history = BookingStatusHistorySerializer(many=True, read_only=True)
    traveller_email = serializers.CharField(
        source="traveller.email", read_only=True, default=None,
    )
    traveller_name = serializers.SerializerMethodField()
    cancelled_by_email = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id", "reference", "status", "payment_status",
            "payment_provider", "transaction_id",
            "traveller_id", "traveller_email", "traveller_name",
            "expires_at", "paid_at", "paid_amount",
            "subtotal", "discount_amount", "fee_amount",
            "tax_amount", "gross_amount", "quoted_total", "currency",
            "source", "trip_plan_id",
            "cancelled_at", "cancellation_reason", "cancellation_note",
            "cancelled_by", "cancelled_by_email",
            "items", "history",
            "created_at", "updated_at",
        ]

    def get_traveller_name(self, obj):
        if obj.traveller:
            return obj.traveller.full_name
        return None

    def get_cancelled_by_email(self, obj):
        if obj.cancelled_by:
            return obj.cancelled_by.email
        return None


class AdminBookingCancelSerializer(serializers.Serializer):
    """Input for admin cancel booking endpoint."""
    note = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=1000,
        default="",
    )

    
