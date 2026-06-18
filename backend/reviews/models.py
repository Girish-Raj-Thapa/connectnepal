from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class ReviewStatus(models.TextChoices):
    PUBLISHED  = 'published', 'Published'
    UNDER_REVIEW = 'under_review', 'Under Review'
    REMOVED = 'removed', 'Removed'
    USER_DELETED = 'user_deleted', 'User Deleted'


class HostReplyStatus(models.TextChoices):
    NONE = 'none', 'None'
    PUBLISHED = 'published', 'Published'
    REMOVED = 'removed', 'Removed'


class Review(models.Model):
    traveller = models.ForeignKey(
        'accounts.Account',
        on_delete=models.CASCADE,
        related_name='reviews_given',
    )

    # XOR: exactly one of listing / package must be set (enforced by CheckConstraint below)
    listing = models.ForeignKey(
        'listings.Listing',
        on_delete=models.CASCADE,
        related_name='reviews',
        null=True,
        blank=True,
    )

    package = models.ForeignKey(
        'packages.Package',
        on_delete=models.CASCADE,
        related_name='reviews',
        null=True,
        blank=True,
    )

    booking_item = models.OneToOneField(
        'bookings.BookingItem',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='review',
    )

    # review content
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )

    comment = models.TextField(blank=True)

    # Status & soft delete
    status = models.CharField(
        max_length=20,
        choices=ReviewStatus.choices,
        default=ReviewStatus.PUBLISHED,
        db_index=True,
    )

    # Edit tracking
    edited_at = models.DateTimeField(null=True, blank=True)
    edit_count = models.PositiveIntegerField(default=0)

    # Soft-delete tracking
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by_user = models.BooleanField(default=False)

    # Moderation
    moderated_at = models.DateTimeField(null=True, blank=True)
    moderated_by = models.ForeignKey(
        'accounts.Account',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='moderated_reviews',
    )
    moderation_reason = models.TextField(blank=True)

    # Host Reply 
    host_reply = models.TextField(blank=True)
    host_reply_status = models.CharField(
        max_length=20,
        choices=HostReplyStatus.choices,
        default=HostReplyStatus.NONE,
    )
    host_replied_at = models.DateTimeField(null=True, blank=True)

    # Host reply moderation
    host_reply_moderated_at = models.DateTimeField(null=True, blank=True)
    host_reply_moderation_reason = models.TextField(blank=True)

    # Snapshot of booking completion date for audit
    completion_date_snapshot = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['listing', 'status', '-created_at']),
            models.Index(fields=['package', 'status', '-created_at']),
            models.Index(fields=['traveller', 'status', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['traveller', 'listing']),
            models.Index(fields=['traveller', 'package']),
        ]
        constraints = [
            # Integrity: listing XOR package must be set, never both, never neither
            models.CheckConstraint(
                check=(
                    models.Q(listing__isnull=False, package__isnull=True) |
                    models.Q(listing__isnull=True,  package__isnull=False)
                ),
                name='review_listing_xor_package',
            ),
        ]
    
    def __str__(self):
        target = self.listing or self.package
        return f"Review by {self.traveller_id} on {target} - {self.rating}★"


class ReviewReport(models.Model):
    class TargetType(models.TextChoices):
        REVIEW = 'review', 'Review'
        HOST_REPLY = 'host_reply', 'Host Reply'

    class Reason(models.TextChoices):
        ABUSIVE_LANGUAGE = 'abusive_language', 'Abusive Language'
        HATE_SPEECH = 'hate_speech', 'Hate Speech'
        THREATS = 'threats', 'Threats'
        SPAM = 'spam', 'Spam'
        IRRELEVANT_CONTENT = 'irrelevant_content', 'Irrelevant Content'
        FRAUDULENT_CLAIM = 'fraudulent_claim', 'Fraudulent Claim'
        PRIVACY_VIOLATION = 'privacy_violation', 'Privacy Violation'
        OTHER = 'other', 'Other'

    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        RESOLVED = 'resolved', 'Resolved'
        DISMISSED = 'dismissed', 'Dismissed'
    
    review = models.ForeignKey(
        Review,
        on_delete=models.CASCADE,
        related_name='reports',
    )
    reporter = models.ForeignKey(
        'accounts.Account',
        on_delete=models.CASCADE,
        related_name='review_reports',
    )
    target_type = models.CharField(
        max_length=20,
        choices=TargetType.choices,
    )
    reason = models.CharField(
        max_length=50,
        choices=Reason.choices,
    )
    details = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        'accounts.Account',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='resolved_review_reports',
    )
    resolution_note = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['review', 'target_type', 'status']),
            models.Index(fields=['status', '-created_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['review', 'reporter', 'target_type'],
                condition=models.Q(status='open'),
                name='unique_open_review_report_per_target',
            ),
        ]
    
    def __str__(self):
        return f"Report #{self.pk} on Review #{self.review_id} ({self.target_type})"


class ReviewEvent(models.Model):
    class EventType(models.TextChoices):
        REVIEW_CREATED = 'review_created', 'Review Created'
        REVIEW_EDITED = 'review_edited', 'Review Edited'
        REVIEW_DELETED = 'review_deleted', 'Review Deleted'
        HOST_REPLY_CREATED = 'host_reply_created', 'Host Reply Created'
        HOST_REPLY_EDITED = 'host_reply_edited', 'Host Reply Edited'
        REVIEW_REPORTED = 'review_reported', 'Review Reported'
        HOST_REPLY_REPORTED = 'host_reply_reported', 'Host Reply Reported'
        REVIEW_MARKED_UNDER_REVIEW = 'review_marked_under_review', 'Review Marked Under Review'
        REVIEW_RESTORED = 'review_restored', 'Review Restored'
        REVIEW_REMOVED = 'review_removed', 'Review Removed'
        HOST_REPLY_REMOVED = 'host_reply_removed', 'Host Reply Removed'

    review = models.ForeignKey(
        Review,
        on_delete=models.CASCADE,
        related_name='events',
    )
    actor = models.ForeignKey(
        'accounts.Account',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    actor_role = models.CharField(max_length=20)  # traveller / host / admin / system
    event_type = models.CharField(
        max_length=50,
        choices=EventType.choices,
    )
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['review', 'event_type']),
        ]

    def __str__(self):
        return f"{self.event_type} on Review #{self.review_id}"
