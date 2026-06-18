from rest_framework import serializers
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "priority",
            "title",
            "body",
            "action_url",
            "image_url",
            "metadata",
            "actor_name",
            "is_read",
            "read_at",
            "is_archived",
            "created_at",
        ]
        read_only_fields = fields

    def get_actor_name(self, obj) -> str | None:
        if obj.actor_id:
            # actor is select_related in query service
            return obj.actor.full_name
        return None


class UnreadCountSerializer(serializers.Serializer):
    unread_count = serializers.IntegerField()
    