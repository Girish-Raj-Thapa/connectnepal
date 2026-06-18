import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger("notifications")


def send_ws_notification(notification) -> None:
    """
    Push a new notification to the recipient's WebSocket group.

    Must be called inside transaction.on_commit() — never inside the atomic block that creates the notification row.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning("No channel layer configured — skipping WS push")
        return

    group_name = f"notifications_user_{notification.recipient_id}"

    payload = {
        "id": notification.pk,
        "notification_type": notification.notification_type,
        "priority": notification.priority,
        "title": notification.title,
        "body": notification.body,
        "action_url": notification.action_url,
        "image_url": notification.image_url,
        "metadata": notification.metadata,
        "actor_name": (
            notification.actor.full_name
            if notification.actor_id else None
        ),
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat(),
    }

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "notification.new",
            "payload": payload,
        },
    )


def send_ws_unread_count(user_id: int, unread_count: int) -> None:
    """
    Push an updated unread count to the user's WebSocket group.
    
    Used after mark-all-read or archive operations.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    group_name = f"notifications_user_{user_id}"

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "notification.unread_count",
            "unread_count": unread_count,
        },
    )
