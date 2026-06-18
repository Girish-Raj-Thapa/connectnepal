from rest_framework import serializers
from .models import (
    Listing, ListingImage, ActivitySlot,
    ListingSchedule, SlotException,
    Category, ActivityType, DifficultyLevel,
    IdealFor, CancellationPolicy, BestSeason, DurationType
)


# NESTED SERIALIZERS: will be used in other serializers

class ListingHostSerializer(serializers.Serializer):
    """
    Lightweight host information for listing displays.
    """

    user_id = serializers.IntegerField(source='user.id', read_only=True)
    business_name = serializers.CharField(read_only=True)
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    profile_photo_url = serializers.SerializerMethodField()
    is_verified = serializers.BooleanField(read_only=True)
    verification_status = serializers.CharField(read_only=True)
    host_since = serializers.DateTimeField(source='created_at', read_only=True)

    def get_profile_photo_url(self, obj):
        """
        Return absolute URL for host profile photo.
        """
        if obj.user.profile_photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.user.profile_photo.url)
            return obj.user.profile_photo_url
        return None
    

class ListingImageSerializer(serializers.ModelSerializer):
    """
    Serializer for listing images.

    Used for both display and upload.

    - Returns FULL absolute URLs (not relative paths)
    - Includes thumbnail for list views
    - Includes alt_text for accessibility
    """
    image_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = ListingImage
        fields = (
            'id',
            'image',           # For upload (write)
            'image_url',       # Full URL for display (read)
            'thumbnail_url',   # Thumbnail URL for cards (read)
            'is_primary',
            'caption',
            'alt_text',
            'order',
            'uploaded_at'
        )
        read_only_fields = ('id', 'image_url', 'thumbnail_url', 'uploaded_at')
        extra_kwargs = {
            'image': {'write_only': True}, 
        }

    def get_image_url(self, obj):
        """
        Return absolute URL for the full image.
        """
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None
    
    def get_thumbnail_url(self, obj):
        """Return absolute URL for the thumbnail."""
        if obj.thumbnail:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.thumbnail.url)
            return obj.thumbnail.url
        # Fallback to main image if no thumbnail
        return self.get_image_url(obj)


class ListingImageUploadSerializer(serializers.Serializer):
    image = serializers.ImageField()
    is_primary = serializers.BooleanField(required=False, default=False)
    caption = serializers.CharField(required=False, allow_blank=True, default="")
    order = serializers.IntegerField(required=False, default=0, min_value=0)


# CREATE SERIALIZER
class ListingCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating new listings.
    """
    average_duration_hours = serializers.DecimalField(
        max_digits=6,
        decimal_places=1,
        required=False,
        help_text="Required for hourly listings"
    )
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        default=list,
        help_text="List of tags, max 15 items"
    )

    best_seasons = serializers.ListField(
        child=serializers.CharField(max_length=20),
        required=False,
        default=list,
        help_text="List of optimal seasons"
    )

    class Meta:
        model = Listing
        fields = (
            # Basic info
            'title',
            'description',
            'destination',
            'location',

            # Classification
            'category',
            'activity_type',
            'difficulty_level',
            'ideal_for',

            # Pricing
            'price_per_person',

            # Duration
            'duration_type',
            'duration_days',
            'duration_nights',
            'average_duration_hours',

            # Group size
            'max_group_size',
            'min_group_size',

            # Metadata
            'tags',

            # Practical info
            'what_to_bring',
            'requirements',
            'inclusions',
            'exclusions',
            'cancellation_policy',
            'languages_offered',

            # Seasons
            'best_seasons',

            # Booking
            'instant_booking',
        )


    # FIELD LEVEL VALIDATIONS
    def validate_title(self, value):
        """
        Validate and normalize the title.

        Rules:
        - Minimum 3 characters (ensures descriptive titles)
        - Strip whitespace
        """
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError(
                "Title must be at least 3 characters long."
            )
        return value    
    
    def validate_description(self, value):
        """
        Ensure description is meaningful.
        """
        value = value.strip()
        if len(value) < 50:
            raise serializers.ValidationError(
                "Description must be at least 50 characters long."
            )
        return value
    
    def validate_price_per_person(self, value):
        """
        Price must be positive.
        """
        if value <= 0:
            raise serializers.ValidationError(
                "Price must be greater than zero."
            )
        return value
    
    def validate_tags(self, value):
        """Limit number of tags to 15."""
        if len(value) > 15:
            raise serializers.ValidationError(
                "Maximum 15 tags allowed."
            )
        # Normalize tags: lowercase, strip whitespace
        return [tag.lower().strip() for tag in value if tag.strip()]

    def validate_ideal_for(self, value):
        """
        Ensures all values are from the IdealFor choices.
        """
        if not isinstance(value, list):
            raise serializers.ValidationError("ideal_for must be a list")

        valid_choices = [choice[0] for choice in IdealFor.choices]
        invalid = [v for v in value if v not in valid_choices]

        if invalid:
            raise serializers.ValidationError(
                f"Invalid values: {invalid}. Must be from: {valid_choices}"
            )

        if len(value) > 6:  # All choices
            raise serializers.ValidationError("Too many selections")

        return value
    
    def validate_inclusions(self, value):
        """
        Validate inclusions list.
        """
        if not isinstance(value, list):
            raise serializers.ValidationError("inclusions must be a list")
        if len(value) > 20:
            raise serializers.ValidationError("Maximum 20 inclusions allowed")
        return value
    
    def validate_exclusions(self, value):
        """
        Validate exclusions list.
        """
        if not isinstance(value, list):
            raise serializers.ValidationError("exclusions must be a list")
        if len(value) > 20:
            raise serializers.ValidationError("Maximum 20 exclusions allowed")
        return value
    
    def validate_languages_offered(self, value):
        """Validate languages list."""
        if not isinstance(value, list):
            raise serializers.ValidationError("languages_offered must be a list")
        if len(value) > 10:
            raise serializers.ValidationError("Maximum 10 languages allowed")
        return [lang.lower().strip() for lang in value if lang.strip()]

    def validate_best_seasons(self, value):
        """Validate best_seasons against BestSeason choices."""
        if not isinstance(value, list):
            raise serializers.ValidationError("best_seasons must be a list")

        valid_choices = [choice[0] for choice in BestSeason.choices]
        invalid = [v for v in value if v not in valid_choices]

        if invalid:
            raise serializers.ValidationError(
                f"Invalid seasons: {invalid}. Must be from: {valid_choices}"
            )

        return list(set(value))  # Remove duplicates

    @staticmethod
    def _normalize_and_validate(data, explicit_duration_type: bool = False):
        """
        Normalize duration fields based on duration_type and validate cross-field rules.
        """
        duration_type = data.get('duration_type')
        days = data.get('duration_days', 1)
        nights = data.get('duration_nights', 0)
        avg_hours = data.get('average_duration_hours')

        if not duration_type:
            if (days or 0) > 1 or (nights or 0) > 0:
                duration_type = DurationType.MULTI_DAY
            else:
                duration_type = DurationType.FULL_DAY
            data['duration_type'] = duration_type

        # If not explicitly set but days/nights indicate multi-day, infer it
        if not explicit_duration_type and duration_type == DurationType.FULL_DAY:
            if (days or 0) > 1 or (nights or 0) > 0:
                duration_type = DurationType.MULTI_DAY
                data['duration_type'] = duration_type

        if duration_type == DurationType.HOURLY:
            if avg_hours is None or avg_hours <= 0:
                raise serializers.ValidationError({
                    'average_duration_hours': "average_duration_hours is required for hourly listings."
                })
            data['duration_days'] = 1
            data['duration_nights'] = 0
            days, nights = 1, 0
        elif duration_type == DurationType.FULL_DAY:
            data['duration_days'] = 1
            data['duration_nights'] = 0
            days, nights = 1, 0
        else:
            if (days or 0) < 2 and (nights or 0) < 1:
                raise serializers.ValidationError({
                    'duration_days': "For multi-day listings, duration_days must be >= 2 or duration_nights >= 1."
                })

        if days == 0 and nights == 0:
            raise serializers.ValidationError({
                'duration_days': "Specify at least duration_days or duration_nights."
            })

        if nights > days + 1:
            raise serializers.ValidationError({
                'duration_nights': "Nights cannot exceed days + 1."
            })

        # Group size validation
        min_size = data.get('min_group_size', 1)
        max_size = data.get('max_group_size', 10)

        if min_size > max_size:
            raise serializers.ValidationError({
                'min_group_size': "Minimum group size cannot exceed maximum group size."
            })

        if min_size < 1:
            raise serializers.ValidationError({
                'min_group_size': "Minimum group size must be at least 1."
            })

        return data

    # CROSS FIELD VALIDATION
    def validate(self, attrs):
        """Validation that involves multiple fields."""
        data = attrs.copy()
        explicit_duration_type = 'duration_type' in attrs
        return self._normalize_and_validate(data, explicit_duration_type=explicit_duration_type)
    

# UPDATE SERIALIZER
class ListingUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating existing listings.
    """

    average_duration_hours = serializers.DecimalField(
        max_digits=6,
        decimal_places=1,
        required=False,
        help_text="Required for hourly listings"
    )
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
    )

    best_seasons = serializers.ListField(
        child=serializers.CharField(max_length=20),
        required=False,
    )

    class Meta:
        model = Listing
        fields = (
            'title',
            'description',
            'destination',
            'location',
            'category',
            'activity_type',
            'difficulty_level',
            'ideal_for',
            'price_per_person',
            'duration_type',
            'duration_days',
            'duration_nights',
            'average_duration_hours',
            'tags',
            'max_group_size',
            'min_group_size',
            'is_bookable',
            'is_active',
            'what_to_bring',
            'requirements',
            'inclusions',
            'exclusions',
            'cancellation_policy',
            'languages_offered',
            'best_seasons',
            'instant_booking',
        )

    def validate_is_bookable(self, value):
        """
        Only allow bookable if listing has at least one image.
        """
        if value is True and self.instance and not self.instance.images.exists():
            raise serializers.ValidationError(
                "Cannot make listing bookable without at least one image."
            )
        return value

    def validate_is_active(self, value):
        """
        Soft delete only: allow setting is_active to False, disallow reactivation.
        """
        if value is True:
            raise serializers.ValidationError(
                "Reactivation is not supported."
            )
        return value

    # Reuse validation from CreateSerializer
    def validate_title(self, value):
        return ListingCreateSerializer.validate_title(self, value)

    def validate_description(self, value):
        return ListingCreateSerializer.validate_description(self, value)

    def validate_price_per_person(self, value):
        return ListingCreateSerializer.validate_price_per_person(self, value)

    def validate_tags(self, value):
        return ListingCreateSerializer.validate_tags(self, value)

    def validate_ideal_for(self, value):
        return ListingCreateSerializer.validate_ideal_for(self, value)

    def validate_best_seasons(self, value):
        return ListingCreateSerializer.validate_best_seasons(self, value)

    def validate(self, attrs):
        if attrs.get('is_active') is False:
            # Soft delete should also hide the listing from public views.
            attrs['is_bookable'] = False
        # Merge with instance values for proper cross-field validation
        merged = {
            'duration_type': getattr(self.instance, 'duration_type', DurationType.FULL_DAY),
            'duration_days': getattr(self.instance, 'duration_days', 1),
            'duration_nights': getattr(self.instance, 'duration_nights', 0),
            'average_duration_hours': getattr(self.instance, 'average_duration_hours', None),
            'min_group_size': getattr(self.instance, 'min_group_size', 1),
            'max_group_size': getattr(self.instance, 'max_group_size', 10),
        }
        merged.update(attrs)

        normalized = ListingCreateSerializer._normalize_and_validate(
            merged,
            explicit_duration_type=('duration_type' in attrs)
        )

        # Apply forced duration fields to update payload
        attrs['duration_days'] = normalized['duration_days']
        attrs['duration_nights'] = normalized['duration_nights']
        attrs['duration_type'] = normalized.get('duration_type', attrs.get('duration_type'))

        return attrs


# READ SERIALIZER
class ListingReadSerializer(serializers.ModelSerializer):
    """
    Full listing details for detail view
    """

    # Nested serializers
    host = ListingHostSerializer(read_only=True)
    images = ListingImageSerializer(many=True, read_only=True)

    duration_display = serializers.CharField(read_only=True)
    host_name = serializers.CharField(read_only=True)

    # Human-readable choice values
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)
    difficulty_level_display = serializers.CharField(source='get_difficulty_level_display', read_only=True)
    cancellation_policy_display = serializers.CharField(source='get_cancellation_policy_display', read_only=True)
    # Computed fields
    total_hours = serializers.SerializerMethodField()
    best_seasons_display = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = (
            # Identifiers
            'id',
            'slug',

            # Relationships
            'host',
            'images',

            # Basic info
            'title',
            'description',
            'destination',
            'location',

            # Classification (value + display)
            'category', 'category_display',
            'activity_type', 'activity_type_display',
            'difficulty_level', 'difficulty_level_display',
            'ideal_for',

            # Pricing & Duration
            'price_per_person',
            'duration_type',
            'duration_days',
            'duration_nights',
            'average_duration_hours',
            'duration_display',
            'total_hours',

            # Metadata
            'tags',

            # Ratings
            'rating_average',
            'rating_count',

            # Booking
            'best_seasons',
            'best_seasons_display',
            'is_bookable',

            # Group size
            'max_group_size',
            'min_group_size',

            # Practical Info
            'what_to_bring',
            'requirements',
            'inclusions',
            'exclusions',
            'cancellation_policy', 'cancellation_policy_display',
            'languages_offered',

            # Booking
            'instant_booking',

            # Computed
            'host_name',

            # Timestamps
            'created_at',
            'updated_at',
        )
        read_only_fields = fields

    def get_total_hours(self, obj):
        """Total hours computed from days/nights for React display."""
        return float(obj.average_duration_hours)

    def get_best_seasons_display(self, obj):
        """Map season codes to display names."""
        season_map = dict(BestSeason.choices)
        return [season_map.get(s, s) for s in (obj.best_seasons or [])]


class ListingListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for list views (GET /api/listings/).
    """

    # Computed fields
    host_name = serializers.CharField(read_only=True)
    duration_display = serializers.CharField(read_only=True)

    # Choice display
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    difficulty_display = serializers.CharField(source='get_difficulty_level_display', read_only=True)

    # Host verification status (important for trust)
    host_is_verified = serializers.BooleanField(source='host.is_verified', read_only=True)

    # Use thumbnail for list, not full image
    primary_image_thumbnail = serializers.SerializerMethodField()

    # Short description for cards (first 150 chars)
    short_description = serializers.SerializerMethodField()

    slug = serializers.SlugField(read_only=True)

    class Meta:
        model = Listing
        fields = (
            'id',
            'slug',
            'title',
            'short_description',
            'destination',
            'category',
            'category_display',
            'activity_type',
            'difficulty_level',
            'difficulty_display',
            'price_per_person',
            'duration_type',
            'duration_days',
            'duration_nights',
            'duration_display',
            'rating_average',
            'rating_count',
            'host_name',
            'host_is_verified',
            'instant_booking',
            'primary_image_thumbnail',
        )
        read_only_fields = fields

    def get_primary_image_thumbnail(self, obj):
        """
        Get THUMBNAIL URL of primary image (not full image).

        Using thumbnail for list views:
        - Faster page load (thumbnail ~20KB vs full ~200KB)
        - Better mobile experience
        - React can lazy-load full image on detail view
        """
        primary = obj.images.filter(is_primary=True).first()
        if primary:
            request = self.context.get('request')
            # Prefer thumbnail, fallback to main image
            image_file = primary.thumbnail if primary.thumbnail else primary.image
            if request and image_file:
                return request.build_absolute_uri(image_file.url)
            return image_file.url if image_file else None
        return None

    def get_short_description(self, obj):
        """Return first 150 chars of description for card preview."""
        if obj.description:
            if len(obj.description) > 150:
                return obj.description[:147] + "..."
            return obj.description
        return ""


class ListingManageSerializer(serializers.ModelSerializer):
    """
    Serializer for host's Manage Listings table.

    Purpose: Provides all fields needed for the manage table including
    visibility status and quick stats.
    """

    primary_image_thumbnail = serializers.SerializerMethodField()
    booking_count = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    duration_display = serializers.CharField(read_only=True)

    class Meta:
        model = Listing
        fields = (
            'id',
            'slug',
            'title',
            'destination',
            'category',
            'category_display',
            'price_per_person',
            'duration_type',
            'duration_days',
            'duration_nights',
            'duration_display',
            'rating_average',
            'rating_count',
            'is_bookable',
            'instant_booking',
            'primary_image_thumbnail',
            'booking_count',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields

    def get_primary_image_thumbnail(self, obj):
        primary = obj.images.filter(is_primary=True).first()
        if primary:
            request = self.context.get('request')
            image_file = primary.thumbnail if primary.thumbnail else primary.image
            if request and image_file:
                return request.build_absolute_uri(image_file.url)
            return image_file.url if image_file else None
        return None

    def get_booking_count(self, obj):
        return obj.booking_count


# ===========================================================================
# SLOT SERIALIZERS
# ===========================================================================

class ActivitySlotSerializer(serializers.ModelSerializer):
    """
    Output serializer for ActivitySlot.
    available_capacity is computed live (capacity minus active non-expired bookings).
    """
    available_capacity = serializers.SerializerMethodField()

    class Meta:
        model = ActivitySlot
        fields = [
            "id", "listing_id",
            "start_date", "end_date", "start_time", "end_time",
            "capacity", "available_capacity",
            "is_active", "created_at",
        ]
        read_only_fields = fields

    def get_available_capacity(self, obj):
        # Use pre-computed annotation from the view queryset when available (avoids N+1)
        if hasattr(obj, "booked_count"):
            return max(obj.capacity - (obj.booked_count or 0), 0)
        # Fallback for single-object responses (e.g. PATCH / POST)
        from django.db.models import Sum
        from django.utils import timezone
        from bookings.models import BookingItem, BookingItemStatus, BookingStatus
        now = timezone.now()
        booked = (
            BookingItem.objects
            .filter(slot=obj, status__in=[BookingItemStatus.PENDING_PAYMENT, BookingItemStatus.CONFIRMED])
            .exclude(booking__expires_at__lt=now)
            .exclude(booking__status=BookingStatus.EXPIRED)
            .aggregate(total=Sum("traveller_count"))["total"] or 0
        )
        return max(obj.capacity - booked, 0)


class ActivitySlotCreateSerializer(serializers.Serializer):
    """
    Input for creating an ActivitySlot.
    Validation is context-aware: the view passes the Listing via context['listing'].

    capacity is optional — defaults to listing.max_group_size and cannot exceed it.
    """
    start_date = serializers.DateField()
    end_date   = serializers.DateField(required=False, allow_null=True)
    start_time = serializers.TimeField(required=False, allow_null=True)
    end_time   = serializers.TimeField(required=False, allow_null=True)
    capacity   = serializers.IntegerField(min_value=1, required=False, allow_null=True)

    def validate(self, data):
        listing = self.context.get("listing")
        dtype   = listing.duration_type if listing else None
        max_cap = listing.max_group_size if listing else None

        # Resolve capacity — default to max_group_size, enforce the ceiling
        cap = data.get("capacity")
        if cap is None:
            data["capacity"] = max_cap
        elif max_cap is not None and cap > max_cap:
            raise serializers.ValidationError(
                f"capacity cannot exceed the listing's max_group_size of {max_cap}."
            )

        if dtype == DurationType.HOURLY:
            if not data.get("start_time") or not data.get("end_time"):
                raise serializers.ValidationError("Hourly slots require start_time and end_time.")
            if data["end_time"] <= data["start_time"]:
                raise serializers.ValidationError("end_time must be after start_time.")
            data["end_date"] = data["start_date"]

        elif dtype == DurationType.FULL_DAY:
            data["end_date"] = data["start_date"]
            data.pop("start_time", None)
            data.pop("end_time", None)

        elif dtype == DurationType.MULTI_DAY:
            if not data.get("end_date"):
                raise serializers.ValidationError("Multi-day slots require end_date.")
            if data["end_date"] <= data["start_date"]:
                raise serializers.ValidationError("end_date must be after start_date.")
            data.pop("start_time", None)
            data.pop("end_time", None)

        return data


class ActivitySlotUpdateSerializer(serializers.Serializer):
    """
    Input for updating an ActivitySlot. Only capacity and is_active can change.
    capacity cannot exceed the listing's max_group_size (passed via context['listing']).
    """
    capacity  = serializers.IntegerField(min_value=1, required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_capacity(self, value):
        listing = self.context.get("listing")
        if listing and value > listing.max_group_size:
            raise serializers.ValidationError(
                f"Capacity cannot exceed the listing's max_group_size of {listing.max_group_size}."
            )
        return value


#===========================================================================
# SCHEDULE SERIALIZERS
#===========================================================================

class ListingScheduleSerializer(serializers.ModelSerializer):
    """
    Output serializer for ListingSchedule.
    """
    class Meta:
        model  = ListingSchedule
        fields = [
            "id", "listing_id",
            "days_of_week", "time_slots",
            "capacity", "advance_days",
            "valid_from", "valid_until",
            "is_active", "created_at",
        ]
        read_only_fields = fields


class ListingScheduleWriteSerializer(serializers.Serializer):
    """
    Input for creating or updating a ListingSchedule.
    Validation is context-aware: view passes the Listing via context['listing'].
    """
    days_of_week = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=6),
        min_length=1,
    )
    time_slots = serializers.ListField(
        child=serializers.DictField(),
        default=list,
        required=False,
    )
    capacity    = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    advance_days = serializers.IntegerField(min_value=1, default=90, required=False)
    valid_from  = serializers.DateField(required=False, allow_null=True)
    valid_until = serializers.DateField(required=False, allow_null=True)
    is_active   = serializers.BooleanField(default=True, required=False)

    def validate_days_of_week(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError("days_of_week must not contain duplicates.")
        return sorted(value)

    def _validate_time_window(self, window):
        """Validate a single {"start": "HH:MM", "end": "HH:MM"} dict."""
        if not isinstance(window, dict):
            raise serializers.ValidationError("Each time_slot entry must be an object.")
        if "start" not in window or "end" not in window:
            raise serializers.ValidationError(
                'Each time_slot must have "start" and "end" keys (format: "HH:MM").'
            )
        try:
            from datetime import time as time_type
            parts_s = window["start"].split(":")
            parts_e = window["end"].split(":")
            start_t = time_type(int(parts_s[0]), int(parts_s[1]))
            end_t   = time_type(int(parts_e[0]), int(parts_e[1]))
        except (ValueError, AttributeError, IndexError):
            raise serializers.ValidationError(
                'time_slot start/end must be valid "HH:MM" strings.'
            )
        if end_t <= start_t:
            raise serializers.ValidationError(
                f"end ({window['end']}) must be after start ({window['start']})."
            )

    def validate(self, data):
        listing = self.context.get("listing")
        dtype   = listing.duration_type if listing else None
        max_cap = listing.max_group_size if listing else None

        # Resolve capacity — default to max_group_size, enforce the ceiling
        cap = data.get("capacity")
        if cap is None:
            data["capacity"] = max_cap
        elif max_cap is not None and cap > max_cap:
            raise serializers.ValidationError(
                f"capacity cannot exceed the listing's max_group_size of {max_cap}."
            )

        time_slots = data.get("time_slots", [])

        if dtype == DurationType.HOURLY:
            if not time_slots:
                raise serializers.ValidationError(
                    "Hourly listings require at least one time_slot."
                )
            for window in time_slots:
                self._validate_time_window(window)
        else:
            if time_slots:
                raise serializers.ValidationError(
                    "time_slots must be empty for FULL_DAY and MULTI_DAY listings."
                )

        valid_from  = data.get("valid_from")
        valid_until = data.get("valid_until")
        if valid_from and valid_until and valid_from >= valid_until:
            raise serializers.ValidationError(
                "valid_from must be before valid_until."
            )

        return data


#===========================================================================
# SLOT EXCEPTION SERIALIZERS
#===========================================================================

class SlotExceptionSerializer(serializers.ModelSerializer):
    """
    Input and output serializer for SlotException.
    Used for both GET (list/detail) and POST/PATCH.
    """
    class Meta:
        model  = SlotException
        fields = [
            "id", "listing_id", "date",
            "is_closed", "capacity_override",
            "note", "created_at",
        ]
        read_only_fields = ["id", "listing_id", "created_at"]

    def validate(self, data):
        is_closed         = data.get("is_closed", getattr(self.instance, "is_closed", False))
        capacity_override = data.get("capacity_override", getattr(self.instance, "capacity_override", None))

        if is_closed and capacity_override is not None:
            raise serializers.ValidationError(
                "is_closed and capacity_override are mutually exclusive. "
                "A closed day cannot also have a capacity override."
            )
        if not is_closed and capacity_override is None:
            raise serializers.ValidationError(
                "Set either is_closed=true or a capacity_override value."
            )
        return data
