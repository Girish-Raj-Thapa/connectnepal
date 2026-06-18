from rest_framework import serializers


class ChatInputSerializer(serializers.Serializer):
    """
    Validates incoming chat messages.
    """

    message = serializers.CharField(
        max_length=2000,
        help_text="The user's message text.",
    )
    session_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Existing session ID to continue a conversation.",
    )
    listing_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Listing ID if the user is asking about a specific listing.",
    )
    package_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Package ID if the user is asking about a specific package.",
    )
    guest_session_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Frontend-generated UUID for guest session tracking.",
    )


class ChatResponseSerializer(serializers.Serializer):
    """
    Shapes the chat response.
    """

    reply = serializers.CharField()
    session_id = serializers.IntegerField()
    intent = serializers.CharField()


class ChatSessionListSerializer(serializers.Serializer):
    """
    Session summary for the session list endpoint.
    """

    id = serializers.IntegerField()
    title = serializers.CharField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    message_count = serializers.IntegerField()


class ChatMessageSerializer(serializers.Serializer):
    """
    A single message in a session.
    """

    role = serializers.CharField()
    content = serializers.CharField()
    intent = serializers.CharField()
    created_at = serializers.DateTimeField()


class ChatSessionDetailSerializer(serializers.Serializer):
    """Full session detail with messages."""

    id = serializers.IntegerField()
    title = serializers.CharField()
    created_at = serializers.DateTimeField()
    messages = ChatMessageSerializer(many=True)
