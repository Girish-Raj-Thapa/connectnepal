from django.urls import path
from ..views import (
    BookingQuoteView,
    BookingListCreateView,
    BookingDetailView,
    BookingCancelView,
    BookingFromTripPlanView,
)

app_name = "bookings_traveller"

urlpatterns = [
    path("quote/", BookingQuoteView.as_view(), name="quote"),

    path("", BookingListCreateView.as_view(), name="list_create"),

    path("<int:pk>/", BookingDetailView.as_view(), name="detail"),

    path("<int:pk>/cancel/", BookingCancelView.as_view(), name="cancel"),

    path("from-trip-plan/<int:plan_id>/", BookingFromTripPlanView.as_view(),  name="from_trip_plan"),
]
