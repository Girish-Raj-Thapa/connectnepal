from django.db.models import QuerySet

from accounts.models import Account
from ..models import Notification


def get_notifications_for_user(user: Account) -> QuerySet:
    """
    Full notification feed for a user (non-archived).

    Returns a QuerySet for pagination by the view layer.
    """
    return Notification.objects.filter(
        recipient=user,
        is_archived=False,
    ).select_related("actor")


def get_recent_notifications(user: Account, limit: int=5) -> QuerySet:
    """
    Most recent notifications for the dropdown bell menu.
    
    Small fixed limit, non-archived only.
    """
    return Notification.objects.filter(
        recipient=user,
        is_archived=False,
    ).select_related("actor")[:limit]


def get_unread_count(user: Account) -> int:
    """
    Count of unread, non-archived notifications.
    
    Uses the (recipient, is_read, created_at) composite index.
    """
    return Notification.objects.filter(
        recipient=user,
        is_read=False,
        is_archived=False,
    ).count()


def get_unread_notifications(user: Account) -> QuerySet:
    """
    All unread, non-archived notifications.
    """
    return Notification.objects.filter(
        recipient=user,
        is_read=False,
        is_archived=False,
    ).select_related("actor")
