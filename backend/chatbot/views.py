import logging

from django.db.models import Count
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsTraveller
from chatbot.models import ChatMessage, ChatSession
from chatbot.serializers import (
    ChatInputSerializer,
    ChatResponseSerializer,
    ChatSessionDetailSerializer,
    ChatSessionListSerializer,
)
from chatbot.services.chat_service import handle_chat_message

logger = logging.getLogger('chatbot')


class ChatView(APIView):
    """
    POST /api/chatbot/chat/

    Send a message and receive a chatbot response.
    Supports both guest and authenticated users.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'chatbot'

    def post(self, request):
        serializer = ChatInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = request.user if request.user.is_authenticated else None

        result = handle_chat_message(
            message=data['message'],
            user=user,
            session_id=data.get('session_id'),
            guest_session_id=(
                str(data['guest_session_id'])
                if data.get('guest_session_id')
                else None
            ),
            listing_id=data.get('listing_id'),
            package_id=data.get('package_id'),
        )

        output = ChatResponseSerializer(result)
        return Response(output.data, status=status.HTTP_200_OK)


class ChatSessionListView(ListAPIView):
    """
    GET /api/chatbot/sessions/

    List the authenticated traveller's chat sessions.
    """
    permission_classes = [IsTraveller]
    serializer_class = ChatSessionListSerializer

    def get_queryset(self):
        return (
            ChatSession.objects
            .filter(user=self.request.user, is_active=True)
            .annotate(message_count=Count('messages'))
            .order_by('-updated_at')
        )


class ChatSessionDetailView(RetrieveAPIView):
    """
    GET /api/chatbot/sessions/<id>/

    Get a session's full message history.
    """
    permission_classes = [IsTraveller]
    serializer_class = ChatSessionDetailSerializer

    def get_queryset(self):
        return ChatSession.objects.filter(user=self.request.user, is_active=True)

    def retrieve(self, request, *args, **kwargs):
        session = self.get_object()
        messages = (
            ChatMessage.objects
            .filter(session=session)
            .order_by('created_at')
            .values('role', 'content', 'intent', 'created_at')
        )

        data = {
            'id': session.pk,
            'title': session.title,
            'created_at': session.created_at,
            'messages': list(messages),
        }

        output = ChatSessionDetailSerializer(data)
        return Response(output.data)
