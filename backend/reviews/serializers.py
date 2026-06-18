from datetime import timedelta
from rest_framework import serializers
from django.utils import timezone

from bookings.models import BookingItem, BookingItemStatus
from .constants import REVIEW_WINDOW_DAYS, EDIT_WINDOW_DAYS, MIN_LOW_RATING_COMMENT_LENGTH
from .models import Review, ReviewReport, ReviewStatus, HostReplyStatus


# Traveller Input

class ReviewCreateSerializer(serializers.Serializer):
    """
    POST /api/reviews/

    Accepts booking_item_id.

    Validates ownership, completed status, 90-day window, and
    duplicate-review rule per booking item.

    Stores resolved listing/package and booking_item in validated_data.
    """
    booking_item_id = serializers.PrimaryKeyRelatedField(
        queryset=BookingItem.objects.select_related("booking", "listing", "package"),
    )
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        traveller = self.context['request'].user
        booking_item = attrs["booking_item_id"]

        # Must belong to requester
        if booking_item.booking.traveller_id != traveller.id:
            raise serializers.ValidationError(
                {"booking_item_id": "You can only review your own booking item."}
            )

        # Must be completed
        if booking_item.status != BookingItemStatus.COMPLETED:
            raise serializers.ValidationError(
                {"booking_item_id": "Booking item must be completed to leave a review."}
            )

        # Must map to exactly one review target
        has_listing = bool(booking_item.listing_id)
        has_package = bool(booking_item.package_id)
        if has_listing == has_package:
            raise serializers.ValidationError(
                {"booking_item_id": "Booking item must reference exactly one target (listing or package)."}
            )

        # 90-day window check
        if not booking_item.completed_at:
            raise serializers.ValidationError(
                {"booking_item_id": "Booking completion timestamp is missing."}
            )
        if timezone.now() > booking_item.completed_at + timedelta(days=REVIEW_WINDOW_DAYS):
            raise serializers.ValidationError(
                {"booking_item_id": f"The review window ({REVIEW_WINDOW_DAYS} days after completion) has closed."}
            )

        # Duplicate check per booking item.
        # Allow re-review only when the previous review was user-deleted.
        existing_review = Review.objects.filter(booking_item=booking_item).first()
        if existing_review and existing_review.status != ReviewStatus.USER_DELETED:
            raise serializers.ValidationError(
                {"booking_item_id": "You have already reviewed this booking item."}
            )

        # Low-rating comment enforcement
        rating = attrs['rating']
        comment = attrs.get('comment', '').strip()
        if rating in (1, 2):
            if not comment or len(comment) < MIN_LOW_RATING_COMMENT_LENGTH:
                raise serializers.ValidationError(
                    {"comment": f"For ratings of 1 or 2 stars, a comment of at least {MIN_LOW_RATING_COMMENT_LENGTH} characters is required."}
                )

        attrs['listing'] = booking_item.listing if has_listing else None
        attrs['package'] = booking_item.package if has_package else None
        attrs['booking_item'] = attrs.pop('booking_item_id')
        attrs['completion_date_snapshot'] = booking_item.completed_at
        return attrs


class ReviewEditSerializer(serializers.Serializer):
    """
    PUT/PATCH /api/reviews/{id}/

    Only rating and comment can be changed.

    Validates edit window, low-rating comment rule.
    """
    rating = serializers.IntegerField(min_value=1, max_value=5, required=False)
    comment = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        review = self.context['review']

        # Status check
        if review.status not in (ReviewStatus.PUBLISHED, ReviewStatus.UNDER_REVIEW):
            raise serializers.ValidationError(
                "You cannot edit a review that has been removed or deleted."
            )

        # Edit window check
        if timezone.now() > review.created_at + timedelta(days=EDIT_WINDOW_DAYS):
            raise serializers.ValidationError(
                f"Reviews can only be edited within {EDIT_WINDOW_DAYS} days of creation."
            )

        # Must have at least one field to update
        if not attrs:
            raise serializers.ValidationError(
                "Provide at least one of 'rating' or 'comment' to update."
            )

        # Determine final rating and comment
        final_rating = attrs.get('rating', review.rating)
        final_comment = attrs.get('comment', review.comment)
        if isinstance(final_comment, str):
            final_comment = final_comment.strip()

        # Low-rating comment enforcement
        if final_rating in (1, 2):
            if not final_comment or len(final_comment) < MIN_LOW_RATING_COMMENT_LENGTH:
                raise serializers.ValidationError(
                    {"comment": f"For ratings of 1 or 2 stars, a comment of at least {MIN_LOW_RATING_COMMENT_LENGTH} characters is required."}
                )

        return attrs


# Output Serializers

class ReviewTravellerSerializer(serializers.Serializer):
    """Minimal traveller info for public display."""
    id = serializers.IntegerField()
    first_name = serializers.CharField()


class ReviewTargetSnapshotMixin:
    def _get_snapshot(self, obj):
        booking_item = getattr(obj, "booking_item", None)
        snapshot = getattr(booking_item, "snapshot", None)
        return snapshot if isinstance(snapshot, dict) else {}

    def get_listing_title(self, obj):
        snapshot = self._get_snapshot(obj)
        if obj.listing_id:
            return snapshot.get("title") or (obj.listing.title if obj.listing else None)
        return None

    def get_package_title(self, obj):
        snapshot = self._get_snapshot(obj)
        if obj.package_id:
            return snapshot.get("package_title") or (obj.package.title if obj.package else None)
        return None


class ReviewReadSerializer(ReviewTargetSnapshotMixin, serializers.ModelSerializer):
    """
    Standard review output for:
      - GET /api/reviews/ (traveller's own list)
      - GET /api/reviews/{id}/ (detail)
      - GET /api/listings/{id}/reviews/ (public)
      - GET /api/packages/{id}/reviews/ (public)
      - Response body after create/edit/reply
    """
    traveller = ReviewTravellerSerializer(read_only=True)
    listing_id = serializers.IntegerField(source='listing.id', read_only=True, allow_null=True)
    package_id = serializers.IntegerField(source='package.id', read_only=True, allow_null=True)
    listing_title = serializers.SerializerMethodField()
    package_title = serializers.SerializerMethodField()
    has_reply = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            'id',
            'traveller',
            'listing_id',
            'package_id',
            'listing_title',
            'package_title',
            'rating',
            'comment',
            'status',
            'host_reply',
            'host_reply_status',
            'host_replied_at',
            'has_reply',
            'created_at',
            'edited_at',
            'edit_count',
            'can_edit',
            'can_delete',
        ]

    def get_has_reply(self, obj):
        return obj.host_reply_status == HostReplyStatus.PUBLISHED and bool(obj.host_reply)

    def get_can_edit(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if obj.traveller_id != request.user.id:
            return False
        if obj.status not in (ReviewStatus.PUBLISHED, ReviewStatus.UNDER_REVIEW):
            return False
        return timezone.now() <= obj.created_at + timedelta(days=EDIT_WINDOW_DAYS)

    def get_can_delete(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if obj.traveller_id != request.user.id:
            return False
        return obj.status in (ReviewStatus.PUBLISHED, ReviewStatus.UNDER_REVIEW)


class ReviewListSerializer(ReviewReadSerializer):
    """
    GET /api/host/reviews/

    Extends ReviewReadSerializer with listing/package title and reply state.
    """
    listing_title = serializers.SerializerMethodField()
    package_title = serializers.SerializerMethodField()
    can_reply = serializers.SerializerMethodField()
    report_count = serializers.SerializerMethodField()

    class Meta(ReviewReadSerializer.Meta):
        fields = ReviewReadSerializer.Meta.fields + [
            'can_reply',
            'report_count',
        ]

    def get_can_reply(self, obj):
        return obj.status == ReviewStatus.PUBLISHED

    def get_report_count(self, obj):
        return obj.reports.filter(status='open').count()


# Host Reply Input

class HostReplySerializer(serializers.Serializer):
    """
    POST /api/host/reviews/{id}/reply/
    """
    reply = serializers.CharField(max_length=2000)

    def validate_reply(self, value):
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("Reply cannot be blank.")
        return stripped


# Report Serializers

class ReviewReportCreateSerializer(serializers.Serializer):
    """
    POST /api/reviews/{id}/report/
    POST /api/host/reviews/{id}/reply/report/
    """
    reason = serializers.ChoiceField(choices=ReviewReport.Reason.choices)
    details = serializers.CharField(required=False, allow_blank=True, default='')


class ReviewReportReadSerializer(serializers.ModelSerializer):
    """Admin-facing report output."""
    reporter_email = serializers.EmailField(source='reporter.email', read_only=True)
    review_id = serializers.IntegerField(source='review.id', read_only=True)
    review_rating = serializers.IntegerField(source='review.rating', read_only=True)
    review_comment = serializers.CharField(source='review.comment', read_only=True)
    review_status = serializers.CharField(source='review.status', read_only=True)
    resolved_by_email = serializers.SerializerMethodField()

    class Meta:
        model = ReviewReport
        fields = [
            'id',
            'review_id',
            'review_rating',
            'review_comment',
            'review_status',
            'reporter_email',
            'target_type',
            'reason',
            'details',
            'status',
            'created_at',
            'resolved_at',
            'resolved_by_email',
            'resolution_note',
        ]

    def get_resolved_by_email(self, obj):
        return obj.resolved_by.email if obj.resolved_by else None


# Moderation Serializers

class ReviewModerateSerializer(serializers.Serializer):
    """
    POST /api/admin/reviews/{id}/moderate/
    """
    action = serializers.ChoiceField(
        choices=['mark_published', 'mark_under_review', 'mark_removed'],
    )
    note = serializers.CharField(required=False, allow_blank=True, default='')


class HostReplyModerateSerializer(serializers.Serializer):
    """
    POST /api/admin/reviews/{id}/reply/moderate/
    """
    action = serializers.ChoiceField(
        choices=['keep_reply', 'remove_reply'],
    )
    note = serializers.CharField(required=False, allow_blank=True, default='')
