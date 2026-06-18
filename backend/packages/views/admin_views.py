from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin
from notifications.constants import NotificationPriority, NotificationType
from notifications.services.notification_realtime_service import send_ws_notification
from notifications.services.notification_service import create_notification
from packages.models import Package


def _queue_ws_notification(notification):
    if notification:
        transaction.on_commit(lambda n=notification: send_ws_notification(n))


class AdminPackageDeactivateView(APIView):
    """
    POST /api/packages/admin/<pk>/deactivate/

    Forcibly deactivates a package and removes it from public booking.
    Sets is_active=False and is_bookable=False.
    Only callable by admin.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        with transaction.atomic():
            package = get_object_or_404(Package.objects.select_for_update(), pk=pk)
            status_changed = package.is_active or package.is_bookable

            package.is_active = False
            package.is_bookable = False
            package.save(update_fields=["is_active", "is_bookable"])

            if status_changed:
                notification = create_notification(
                    recipient=package.host.user,
                    actor=request.user,
                    notification_type=NotificationType.PACKAGE_DEACTIVATED,
                    title="Package Deactivated",
                    body=(
                        f'Your package "{package.title}" was deactivated by the '
                        "admin team."
                    ),
                    action_url=f"/host/packages/{package.pk}/edit",
                    metadata={"package_id": package.pk},
                    priority=NotificationPriority.HIGH,
                )
                _queue_ws_notification(notification)

        return Response({"detail": f"Package {pk} has been deactivated."})


class AdminPackageActivateView(APIView):
    """
    POST /api/packages/admin/<pk>/activate/

    Re-activates a package so the host can manage it again.
    Sets is_active=True. is_bookable is left as-is — the host controls that.
    Only callable by admin.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        with transaction.atomic():
            package = get_object_or_404(Package.objects.select_for_update(), pk=pk)
            status_changed = not package.is_active

            package.is_active = True
            package.save(update_fields=["is_active"])

            if status_changed:
                notification = create_notification(
                    recipient=package.host.user,
                    actor=request.user,
                    notification_type=NotificationType.PACKAGE_ACTIVATED,
                    title="Package Activated",
                    body=(
                        f'Your package "{package.title}" was activated and can be '
                        "managed again."
                    ),
                    action_url=f"/host/packages/{package.pk}/edit",
                    metadata={"package_id": package.pk},
                    priority=NotificationPriority.NORMAL,
                )
                _queue_ws_notification(notification)

        return Response({"detail": f"Package {pk} has been activated."})
