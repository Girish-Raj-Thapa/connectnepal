from django.urls import path
from ..views import (
    HostBookingItemListView,
    HostBookingItemDetailView,
    HostBookingItemMarkCompletedView,
)

app_name = "bookings_host"

urlpatterns = [
    path("", HostBookingItemListView.as_view(), name="item_list"),

    path("<int:item_id>/", HostBookingItemDetailView.as_view(), name="item_detail"),

    path("<int:item_id>/mark-completed/", HostBookingItemMarkCompletedView.as_view(), name="item_mark_completed"),
]