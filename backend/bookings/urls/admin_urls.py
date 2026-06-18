from django.urls import path

from ..views import (
    AdminBookingListView,
    AdminBookingDetailView,
    AdminBookingCancelView,
)

app_name = "bookings_admin"

urlpatterns = [
    path("", AdminBookingListView.as_view(), name="list"),
    path("<int:pk>/", AdminBookingDetailView.as_view(), name="detail"),
    path("<int:pk>/cancel/", AdminBookingCancelView.as_view(), name="cancel"),
]
