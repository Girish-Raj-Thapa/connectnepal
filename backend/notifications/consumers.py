import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger("notifications")


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    Per-user WebSocket consumer for live notification delivery.

        - Authenticated users join a per-user channel group.
        - The consumer is read-only from the client's perspective.
        - All messages are server-initiated (new notification, unread count sync).
        - Client messages are ignored.
    """

    @property
    def group_name(self) -> str:
        return f"notifications_user_{self.scope['user'].pk}"

    async def connect(self):
        user = self.scope.get("user", AnonymousUser())
        if isinstance(user, AnonymousUser) or not user.is_authenticated:
            await self.close(code=4401)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.debug("WS connected: user=%s group=%s", user.pk, self.group_name)

    async def disconnect(self, close_code):
        user = self.scope.get("user", AnonymousUser())
        if user.is_authenticated:
            await self.channel_layer.group_discard(
                self.group_name, self.channel_name
            )
        logger.debug("WS disconnected: user=%s code=%s", getattr(user, 'pk', '?'), close_code)

    async def receive(self, text_data=None, bytes_data=None):
        # Client-to-server messages are not supported.
        # Silently ignore to keep the socket read-only.
        pass

    async def send_json(self, content):
        """Helper to send JSON-serialized data over the socket."""
        await self.send(text_data=json.dumps(content))

    # Server-to-client event handlers

    async def notification_new(self, event):
        """
        Called when a new notification is published to this user's group.

        event["payload"] contains the serialized notification data.
        """
        await self.send_json({
            "type": "new_notification",
            "payload": event["payload"],
        })

    async def notification_unread_count(self, event):
        """
        Called to sync the unread count after bulk operations (e.g., mark-all-read).
        """
        await self.send_json({
            "type": "unread_count_sync",
            "payload": {
                "unread_count": event["unread_count"],
            },
        })
