from django.urls import path
from .views import (
    EsewaPaymentInitiateView,
    EsewaPaymentCallbackView,
    PaymentAttemptStatusView,
    PaymentDetailView,
)

app_name = "payments"

urlpatterns = [
    # Initiate eSewa payment: returns form_url + signed fields
    path("esewa/initiate/", EsewaPaymentInitiateView.as_view(), name="esewa_initiate"),

    # eSewa callback redirect — no auth required (browser redirect from eSewa)
    # Uses transaction_uuid (not PK) so eSewa's redirect can be correlated
    # without any session or auth token.
    path("esewa/callback/<str:transaction_uuid>/", EsewaPaymentCallbackView.as_view(),name="esewa_callback"),

    # Poll attempt status for frontend processing page
    path("attempts/<int:attempt_id>/status/", PaymentAttemptStatusView.as_view(), name="attempt_status"),

    # Payment detail (receipt page)
    path("<int:payment_id>/", PaymentDetailView.as_view(), name="payment_detail"),
]