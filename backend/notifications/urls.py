from django.urls import path
from . import views

app_name = "notifications"

urlpatterns = [
    path("", views.NotificationListView.as_view(), name="list"),
    path("recent/", views.RecentNotificationsView.as_view(), name="recent"),
    path("unread-count/", views.UnreadCountView.as_view(), name="unread-count"),
    path("mark-all-read/", views.MarkAllReadView.as_view(), name="mark-all-read"),
    path("archive-read/", views.ArchiveReadView.as_view(), name="archive-read"),
    path("<int:pk>/mark-read/", views.MarkNotificationReadView.as_view(), name="mark-read"),
    path("<int:pk>/archive/", views.ArchiveNotificationView.as_view(), name="archive"),
]
