from rest_framework import serializers

from listings.models import Listing
from packages.models import Package
from recommendations.constants import (
    ALLOWED_EVENT_TYPES,
    ALLOWED_INTERACTION_EVENT_TYPES,
    ALLOWED_INTERACTION_SURFACES,
    ALLOWED_STRATEGIES,
    ALLOWED_SURFACES,
)


class RecommendedListingSerializer(serializers.ModelSerializer):
    """
    Serializer for recommended listing cards.

    Reuses the same shape as ListingListSerializer from the listings app to maintain consistent listing card format across the frontend.
    """
    short_description = serializers.SerializerMethodField()
    duration_display = serializers.CharField(read_only=True)
    host_name = serializers.CharField(read_only=True)
    category_display = serializers.CharField(
        source='get_category_display', read_only=True
    )
    difficulty_display = serializers.CharField(
        source='get_difficulty_level_display', read_only=True
    )
    host_is_verified = serializers.BooleanField(
        source='host.is_verified', read_only=True
    )
    primary_image_thumbnail = serializers.SerializerMethodField()
    position = serializers.IntegerField(read_only=True)

    class Meta:
        model = Listing
        fields = [
            'id',
            'slug',
            'title',
            'short_description',
            'destination',
            'category',
            'category_display',
            'difficulty_level',
            'difficulty_display',
            'price_per_person',
            'duration_type',
            'duration_days',
            'duration_nights',
            'duration_display',
            'rating_average',
            'rating_count',
            'instant_booking',
            'host_name',
            'host_is_verified',
            'primary_image_thumbnail',
            'position',
        ]

    def get_short_description(self, obj) -> str:
        desc = obj.description or ''
        if len(desc) > 150:
            return desc[:150] + '...'
        return desc

    def get_primary_image_thumbnail(self, obj) -> str | None:
        request = self.context.get('request')
        primary = obj.primary_image
        if primary is None:
            return None
        image_field = primary.thumbnail if primary.thumbnail else primary.image
        if image_field and request:
            return request.build_absolute_uri(image_field.url)
        elif image_field:
            return image_field.url
        return None


class RecommendedPackageSerializer(serializers.ModelSerializer):
    """
    Serializer for recommended package cards.

    Mirrors the public package list shape closely while adding `position` so the recommendation response preserves ordering.
    """
    listing_count = serializers.IntegerField(read_only=True)
    cover_image_url = serializers.SerializerMethodField()
    host_name = serializers.SerializerMethodField()
    has_upcoming_slots = serializers.SerializerMethodField()
    next_available_slot = serializers.SerializerMethodField()
    position = serializers.IntegerField(read_only=True)

    class Meta:
        model = Package
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'duration_days',
            'duration_nights',
            'total_price',
            'discount_label',
            'tags',
            'listing_count',
            'cover_image_url',
            'host_name',
            'booking_count',
            'has_upcoming_slots',
            'next_available_slot',
            'created_at',
            'position',
        ]
        read_only_fields = fields

    def get_cover_image_url(self, obj):
        if not obj.cover_image:
            return None
        request = self.context.get('request')
        return (
            request.build_absolute_uri(obj.cover_image.url)
            if request else obj.cover_image.url
        )

    def get_host_name(self, obj):
        return obj.host.business_name or obj.host.user.get_full_name()

    def get_has_upcoming_slots(self, obj):
        upcoming_slots = getattr(obj, 'upcoming_slots', None)
        if upcoming_slots is not None:
            return bool(upcoming_slots)
        from datetime import date
        return obj.slots.filter(is_active=True, start_date__gte=date.today()).exists()

    def get_next_available_slot(self, obj):
        upcoming_slots = getattr(obj, 'upcoming_slots', None)
        if upcoming_slots is None:
            from datetime import date
            slot = (
                obj.slots.filter(is_active=True, start_date__gte=date.today())
                .order_by('start_date')
                .first()
            )
        else:
            slot = upcoming_slots[0] if upcoming_slots else None

        if slot is None:
            return None
        return {
            'id': slot.id,
            'start_date': slot.start_date.isoformat(),
            'end_date': slot.end_date.isoformat(),
        }


class RecommendationMetaSerializer(serializers.Serializer):
    """
    Serializer for the `meta` block in recommendation responses.
    """
    request_id = serializers.UUIDField(read_only=True)
    strategy = serializers.CharField(read_only=True)
    model_version = serializers.CharField(read_only=True, allow_blank=True)
    used_fallback = serializers.BooleanField(read_only=True)
    personalized_count = serializers.IntegerField(read_only=True)
    fallback_count = serializers.IntegerField(read_only=True)
    behavior_event_count = serializers.IntegerField(read_only=True, default=0)
    behavior_listing_count = serializers.IntegerField(read_only=True, default=0)


class ForYouRecommendationMetaSerializer(RecommendationMetaSerializer):
    """
    Extended serializer for the `/for-you/` response `meta` block.
    """
    recommendation_event_count = serializers.IntegerField(
        read_only=True, default=0
    )
    interaction_event_count = serializers.IntegerField(read_only=True, default=0)
    behavior_signal_source = serializers.CharField(read_only=True, default='none')


class SingleEventSerializer(serializers.Serializer):
    """
    Validates a single interaction event from the frontend.
    """
    request_id = serializers.UUIDField()
    listing_id = serializers.IntegerField(required=False, allow_null=True)
    event_type = serializers.ChoiceField(choices=sorted(ALLOWED_EVENT_TYPES))
    surface = serializers.ChoiceField(choices=sorted(ALLOWED_SURFACES))
    strategy = serializers.ChoiceField(choices=sorted(ALLOWED_STRATEGIES))
    model_version = serializers.CharField(
        max_length=100, required=False, default='', allow_blank=True
    )
    position = serializers.IntegerField(
        min_value=1, required=False, allow_null=True
    )
    session_id = serializers.CharField(
        max_length=64, required=False, default='', allow_blank=True
    )
    metadata = serializers.JSONField(required=False, default=dict)

    def validate_listing_id(self, value):
        """
        Validate that listing_id references a real listing if provided.
        Only check existence, not visibility.
        """
        if value is not None and not Listing.objects.filter(pk=value).exists():
            raise serializers.ValidationError(
                f"Listing {value} does not exist."
            )
        return value


class EventBatchSerializer(serializers.Serializer):
    """
    Validates a batch of interaction events.
    """
    events = SingleEventSerializer(many=True)

    def validate_events(self, value):
        if not value:
            raise serializers.ValidationError("At least one event is required.")
        if len(value) > 100:
            raise serializers.ValidationError(
                "Maximum 100 events per batch."
            )
        return value
    

class SingleInteractionSerializer(serializers.Serializer):
    """
    Validates a single general listing interaction event.

    Unlike SingleEventSerializer (which handles recommendation attribution events), this serializer does not require request_id, strategy, or model_version.
    """
    listing_id = serializers.IntegerField()
    event_type = serializers.ChoiceField(
        choices=sorted(ALLOWED_INTERACTION_EVENT_TYPES),
    )
    surface = serializers.ChoiceField(
        choices=sorted(ALLOWED_INTERACTION_SURFACES),
    )
    position = serializers.IntegerField(
        min_value=1, required=False, allow_null=True,
    )
    metadata = serializers.JSONField(required=False, default=dict)

    def validate_listing_id(self, value):
        if not Listing.objects.filter(pk=value).exists():
            raise serializers.ValidationError(
                f"Listing {value} does not exist."
            )
        return value


class InteractionBatchSerializer(serializers.Serializer):
    """
    Validates a batch of general listing interaction events.
    """
    events = SingleInteractionSerializer(many=True)

    def validate_events(self, value):
        if not value:
            raise serializers.ValidationError("At least one event is required.")
        if len(value) > 50:
            raise serializers.ValidationError(
                "Maximum 50 events per batch."
            )
        return value
