from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer, UnreadCountSerializer
from .services import notification_query_service, notification_service
from .services.notification_realtime_service import send_ws_unread_count


class NotificationListView(generics.ListAPIView):
    """
    GET /api/notifications/

    Paginated feed of non-archived notifications for the authenticated user.
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return notification_query_service.get_notifications_for_user(
            self.request.user
        )
    

class RecentNotificationsView(APIView):
    """
    GET /api/notifications/recent/

    Last 5 notifications for the bell dropdown. Not paginated.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = notification_query_service.get_recent_notifications(
            request.user, limit=5
        )
        serializer = NotificationSerializer(qs, many=True)
        return Response(serializer.data)


class UnreadCountView(APIView):
    """
    GET /api/notifications/unread-count/

    Returns {"unread_count": N}.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = notification_query_service.get_unread_count(request.user)
        return Response(UnreadCountSerializer({"unread_count": count}).data)    


class MarkNotificationReadView(APIView):
    """
    POST /api/notifications/<id>/mark-read/

    Marks a single notification as read. Returns the updated notification.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(
                pk=pk, recipient=request.user
            )
        except Notification.DoesNotExist:
            return Response(
                {"detail": "Notification not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        notification_service.mark_notification_read(notification)
        return Response(NotificationSerializer(notification).data)
    

class MarkAllReadView(APIView):
    """
    POST /api/notifications/mark-all-read/

    Marks all unread notifications as read. Returns count updated.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        count = notification_service.mark_all_notifications_read(request.user)
        unread = notification_query_service.get_unread_count(request.user)
        # Sync unread count across all connected tabs
        send_ws_unread_count(request.user.pk, unread)
        return Response({"updated": count, "unread_count": unread})
    

class ArchiveNotificationView(APIView):
    """
    POST /api/notifications/<id>/archive/

    Archives a single notification. Returns the updated notification.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(
                pk=pk, recipient=request.user
            )
        except Notification.DoesNotExist:
            return Response(
                {"detail": "Notification not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        notification_service.archive_notification(notification)
        return Response(NotificationSerializer(notification).data)


class ArchiveReadView(APIView):
    """
    POST /api/notifications/archive-read/

    Archives all read notifications. Returns count archived.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        count = notification_service.archive_read_notifications(request.user)
        return Response({"archived": count})
