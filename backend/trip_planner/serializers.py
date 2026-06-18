from rest_framework import serializers
from .models import TripPlanner, TripPlannerItem, TripStatus

# =========================
# NESTED SERIALIZERS
# =========================

class TripPlannerItemListingSerializer(serializers.Serializer):
    """
    Lightweight listing info embedded in trip plan items.

    Shows enough to identify the experience in the timeline.
    """
    id = serializers.IntegerField(read_only=True)
    title = serializers.CharField(read_only=True)
    slug = serializers.SlugField(read_only=True)
    destination = serializers.CharField(read_only=True)
    category = serializers.CharField(read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    price_per_person = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    duration_display = serializers.CharField(read_only=True)
    primary_image_thumbnail = serializers.SerializerMethodField()
    is_bookable = serializers.BooleanField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    def get_primary_image_thumbnail(self, obj):
        """
        Thumbnail URL for the listing's primary image.
        Pattern: Same as ListingListSerializer.get_primary_image_thumbnail
        """
        primary = obj.images.filter(is_primary=True).first()
        if primary:
            request = self.context.get('request')
            image_file = primary.thumbnail if primary.thumbnail else primary.image
            if request and image_file:
                return request.build_absolute_uri(image_file.url)
            return image_file.url if image_file else None
        return None
    

# =========================
# TRIP PLAN ITEM SERIALIZERS
# =========================

class TripPlannerItemReadSerializer(serializers.ModelSerializer):
    """
    Full item details for the trip detail view.

    Includes nested listing info + snapshots.
    """
    listing = TripPlannerItemListingSerializer(read_only=True)
    is_available_for_booking = serializers.SerializerMethodField()
    availability_message = serializers.SerializerMethodField()

    class Meta:
        model = TripPlannerItem
        fields = (
            'id',
            'listing',
            'is_available_for_booking',
            'availability_message',
            'day_number',
            'order',
            'price_snapshot',
            'duration_type_snapshot',
            'duration_days_snapshot',
            'duration_nights_snapshot',
            'duration_hours_snapshot',
            'notes',
            'added_at',
        )
        read_only_fields = fields

    def _get_availability_state(self, obj):
        listing = obj.listing
        if not listing.host.user.is_active:
            return False, "This listing is unavailable because the host account is inactive."
        if not listing.is_active:
            return False, "This listing was removed by the host."
        if not listing.is_bookable:
            return False, "This listing is currently unavailable for booking."
        return True, None

    def get_is_available_for_booking(self, obj):
        available, _ = self._get_availability_state(obj)
        return available

    def get_availability_message(self, obj):
        _, message = self._get_availability_state(obj)
        return message


class TripPlannerItemCreateSerializer(serializers.Serializer):
    """
    Serializer for adding a listing to a trip plan.

    Only requires listing_id and day_number.
    price_snapshot and duration_hours_snapshot are set by the service layer.
    """
    listing_id = serializers.IntegerField(
        help_text="ID of the listing to add"
    )
    day_number = serializers.IntegerField(
        help_text="Day number (1-based, 1..total_days)"
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Optional traveller notes"
    )

    def validate_listing_id(self, value):
        from listings.models import Listing
        try:
            Listing.objects.get(id=value)
        except Listing.DoesNotExist:
            raise serializers.ValidationError("Listing not found.")
        return value

    def validate_day_number(self, value):
        if value < 1:
            raise serializers.ValidationError("day_number must be at least 1.")
        return value
    

class TripPlannerItemUpdateSerializer(serializers.Serializer):
    """
    Serializer for updating an item (move day, reorder, edit notes).

    All fields optional for partial updates.
    """
    day_number = serializers.IntegerField(required=False)
    order = serializers.IntegerField(required=False)
    notes = serializers.CharField(
        required=False,
        allow_blank=True
    )

    def validate_day_number(self, value):
        if value < 1:
            raise serializers.ValidationError("day_number must be at least 1.")
        return value

    def validate_order(self, value):
        if value < 0:
            raise serializers.ValidationError("order must be non-negative.")
        return value
    

class BulkReorderItemSerializer(serializers.Serializer):
    """
    Single entry in a bulk reorder request.
    """
    item_id = serializers.IntegerField()
    day_number = serializers.IntegerField()
    order = serializers.IntegerField()

    def validate_day_number(self, value):
        if value < 1:
            raise serializers.ValidationError("day_number must be at least 1.")
        return value

    def validate_order(self, value):
        if value < 0:
            raise serializers.ValidationError("order must be non-negative.")
        return value


# =========================
# TRIP PLAN SERIALIZERS
# =========================

class TripPlannerCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating a new trip plan.
    """
    class Meta:
        model = TripPlanner
        fields = (
            'title',
            'total_days',
            'travellers_count',
            'start_date',
            'end_date',
        )
    
    # Field level validations
    def validate_title(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError(
                "Title must be at least 3 characters long."
            )
        return value
    
    def validate_total_days(self, value):
        if value < 1:
            raise serializers.ValidationError(
                "total_days must be at least 1."
            )
        if value > 30:
            raise serializers.ValidationError(
                "total_days cannot exceed 30."
            )
        return value

    def validate_travellers_count(self, value):
        if value < 1:
            raise serializers.ValidationError(
                "travellers_count must be at least 1."
            )
        if value > 50:
            raise serializers.ValidationError(
                "travellers_count cannot exceed 50."
            )
        return value
    
    # Cross field validations
    def validate(self, attrs):
        start = attrs.get('start_date')
        end = attrs.get('end_date')

        if start and end and end < start:
            raise serializers.ValidationError({
                'end_date': "end_date must be on or after start_date."
            })

        return attrs
    

class TripPlannerUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating an existing trip plan.

    All fields optional for PATCH.
    """

    class Meta:
        model = TripPlanner
        fields = (
            'title',
            'total_days',
            'travellers_count',
            'start_date',
            'end_date',
            'status',
        )
    
    def validate_title(self, value):
        return TripPlannerCreateSerializer.validate_title(self, value)

    def validate_total_days(self, value):
        return TripPlannerCreateSerializer.validate_total_days(self, value)

    def validate_travellers_count(self, value):
        return TripPlannerCreateSerializer.validate_travellers_count(self, value)
    

    def validate_status(self, value):
        """
        Validate status transitions.

        Rules:
        - Travellers can only set: planning, archived
        - booked/completed are reserved for future booking module
        - Cannot update an already archived plan
        """

        if self.instance and self.instance.status == TripStatus.ARCHIVED:
            raise serializers.ValidationError(
                "Cannot update an archived trip plan."
            )
        
        TRAVELLER_ALLOWED = [TripStatus.PLANNING, TripStatus.ARCHIVED]
        if value not in TRAVELLER_ALLOWED:
            raise serializers.ValidationError(
                f"Invalid status. Travellers can only set: {[s.value for s in TRAVELLER_ALLOWED]}. "
                f"'booked' and 'completed' are set by the booking system."
            )
        return value
    

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))

        if start and end and end < start:
            raise serializers.ValidationError({
                'end_date': "end_date must be on or after start_date."
            })

        return attrs


class TripPlannerListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for the trip plan list view.

    Shows summary info for trip cards.
    """
    item_count = serializers.IntegerField(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = TripPlanner
        fields = (
            'id',
            'title',
            'status',
            'status_display',
            'start_date',
            'end_date',
            'total_days',
            'travellers_count',
            'estimated_cost',
            'cover_image',
            'item_count',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields


class TripPlannerDetailSerializer(serializers.ModelSerializer):
    """
    Full trip plan with items grouped by day.

    Used for the trip detail/timeline view.
    """
    items_by_day = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = TripPlanner
        fields = (
            'id',
            'title',
            'status',
            'status_display',
            'start_date',
            'end_date',
            'total_days',
            'travellers_count',
            'estimated_cost',
            'cover_image',
            'item_count',
            'items_by_day',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields
    
    def get_item_count(self, obj):
        return obj.items.active().count()
    
    def get_items_by_day(self, obj):
        """
        Group items by day_number for the timeline view.

        Returns:
        {
            "1": [ {item}, {item} ],
            "2": [ {item} ],
            ...
        }

        Every day from 1..total_days is included (empty days get []).
        """
        items = obj.items.active().select_related(
            'listing',
            'listing__host',
            'listing__host__user',
        ).prefetch_related(
            'listing__images'
        ).order_by('day_number', 'order')

        # Build day → items mapping
        day_map = {str(day): [] for day in range(1, obj.total_days + 1)}

        for item in items:
            key = str(item.day_number)
            if key in day_map:
                day_map[key].append(
                    TripPlannerItemReadSerializer(item, context=self.context).data
                )
        
        return day_map
