import logging
from django.db import IntegrityError
from django.utils import timezone

from accounts.models import Account
from ..models import Notification
from ..constants import NotificationType, NotificationPriority

logger = logging.getLogger("notifications")


def create_notification(
    *,
    recipient: Account,
    notification_type: str,
    title: str,
    body: str = "",
    actor: Account | None = None,
    action_url: str = "",
    image_url: str = "",
    metadata: dict | None = None,
    priority: str = NotificationPriority.NORMAL,
    dedupe_key: str = "",
) -> Notification | None:
    """
    Create a single in-app notification.

    Must be called inside @transaction.atomic (same transaction as the business event). Returns None if dedupe_key already exists for this recipient (silently skipped, not an error).

    Skips inactive recipients (is_active=False) since they cannot log in to see notifications.
    """
    if not recipient.is_active:
        logger.debug(
            "Skipping notification for inactive user %s (type=%s)",
            recipient.pk, notification_type,
        )
        return None
    
    try:
        notification = Notification.objects.create(
            recipient=recipient,
            actor=actor,
            notification_type=notification_type,
            priority=priority,
            title=title,
            body=body,
            action_url=action_url,
            image_url=image_url,
            metadata=metadata or {},
            dedupe_key=dedupe_key,
        )
    except IntegrityError:
        # Dedupe constraint violation — this notification already exists.
        logger.info(
            "Duplicate notification skipped: dedupe_key=%s, recipient=%s",
            dedupe_key, recipient.pk,
        )
        return None

    return notification


def create_notifications_bulk(notifications_data: list[dict]) -> list[Notification]:
    """
    Create multiple notifications in a single query. Each dict in the list must contain the same kwargs as create_notification().

    Dedupe is handled by filtering out existing dedupe_keys before insert.
    
    Skips inactive recipients.
    """
    if not notifications_data:
        return []

    # Collect dedupe_keys that need checking
    dedupe_pairs = [
        (d["recipient"].pk, d.get("dedupe_key", ""))
        for d in notifications_data
        if d.get("dedupe_key")
    ]

    existing_keys = set()
    if dedupe_pairs:
        from django.db.models import Q
        q = Q()
        for recipient_id, key in dedupe_pairs:
            q |= Q(recipient_id=recipient_id, dedupe_key=key)
        existing_keys = set(
            Notification.objects.filter(q).values_list(
                "recipient_id", "dedupe_key"
            )
        )

    objects_to_create = []
    for data in notifications_data:
        recipient = data["recipient"]
        if not recipient.is_active:
            continue
        dedupe_key = data.get("dedupe_key", "")
        if dedupe_key and (recipient.pk, dedupe_key) in existing_keys:
            continue
        objects_to_create.append(
            Notification(
                recipient=recipient,
                actor=data.get("actor"),
                notification_type=data["notification_type"],
                priority=data.get("priority", NotificationPriority.NORMAL),
                title=data["title"],
                body=data.get("body", ""),
                action_url=data.get("action_url", ""),
                image_url=data.get("image_url", ""),
                metadata=data.get("metadata", {}),
                dedupe_key=dedupe_key,
            )
        )

    if not objects_to_create:
        return []

    return Notification.objects.bulk_create(objects_to_create)


def mark_notification_read(notification: Notification) -> Notification:
    """
    Mark a single notification as read. Idempotent.
    """
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=["is_read", "read_at", "updated_at"])
    return notification


def mark_all_notifications_read(user: Account) -> int:
    """
    Mark all unread notifications for a user as read.

    Returns the count of notifications updated.
    """
    now = timezone.now()
    return Notification.objects.filter(
        recipient=user,
        is_read=False,
    ).update(is_read=True, read_at=now, updated_at=now)


def archive_notification(notification: Notification) -> Notification:
    """
    Archive a single notification. Idempotent.
    """
    if not notification.is_archived:
        notification.is_archived = True
        notification.archived_at = timezone.now()
        notification.save(update_fields=["is_archived", "archived_at", "updated_at"])
    return notification


def archive_read_notifications(user: Account) -> int:
    """
    Archive all read notifications for a user.
    
    Returns count of notifications archived.
    """
    now = timezone.now()
    return Notification.objects.filter(
        recipient=user,
        is_read=True,
        is_archived=False,
    ).update(is_archived=True, archived_at=now, updated_at=now)
