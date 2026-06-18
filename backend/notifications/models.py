from django.conf import settings
from django.db import models

from notifications.constants import NotificationType, NotificationPriority


class Notification(models.Model):
    """
     Persistent in-app notification. Source of truth for the bell-icon feed.

    Created inside @transaction.atomic alongside the business event that triggers it. WebSocket push and email dispatch happen only after the transaction commits (via transaction.on_commit).
    """

    # receiver 
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )

    # triggerer
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    # notifcation classifications 
    notification_type = models.CharField(
        max_length=60,
        choices=NotificationType.choices,
        db_index=True,
    )
    priority = models.CharField(
        max_length=10,
        choices=NotificationPriority.choices,
        default=NotificationPriority.NORMAL,
    )

    # display content 
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True, default="")

    # navigations
    action_url = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Relative frontend URL the user navigates to on click.",
    )
    image_url = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Optional thumbnail/avatar URL for display.",
    )

    # Structured payload
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Arbitrary structured data for frontend rendering.",
    )

    # Read state
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    # Archive state
    is_archived = models.BooleanField(default=False, db_index=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    # Deduplication
    dedupe_key = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        help_text=(
            "Unique key scoped to recipient. If set, prevents duplicate "
            "notifications for the same event+recipient combination."
        ),
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["recipient", "is_read", "-created_at"],
                name="notif_recipient_unread",
            ),
            # Feed query: non-archived notifications for a user
            models.Index(
                fields=["recipient", "is_archived", "-created_at"],
                name="notif_recipient_feed",
            ),
            # Dedupe lookups
            models.Index(
                fields=["recipient", "dedupe_key"],
                name="notif_recipient_dedupe",
            ),
        ]
        constraints = [
            # Enforce dedupe uniqueness: only one non-empty dedupe_key per recipient.
            # Empty strings are excluded so that notifications without dedupe
            # keys do not conflict.
            models.UniqueConstraint(
                fields=["recipient", "dedupe_key"],
                name="unique_notification_dedupe",
                condition=models.Q(dedupe_key__gt=""),
            ),
        ]
    
    def __str__(self):
        return f"[{self.notification_type}] → {self.recipient_id}: {self.title[:50]}"
    