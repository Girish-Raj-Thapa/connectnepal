import logging
from urllib.parse import quote as url_quote

from django.conf import settings
from django.shortcuts import redirect
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from accounts.permissions import IsTraveller
from bookings.models import Booking
from utils.exceptions import ServiceError
from .models import AttemptStatus
from .serializers import (
    EsewaInitiateInputSerializer,
    EsewaInitiateResponseSerializer,
    PaymentAttemptStatusSerializer,
    PaymentSerializer,
)
from .services.payment_service import PaymentService, _get_failure_reason_code

logger = logging.getLogger(__name__)


# Allowlisted reason codes for redirect URL ?reason= param.
# ONLY these values will ever appear in the redirect URL.
# Never echo raw eSewa response text into the URL.
_ALLOWED_REASON_CODES = frozenset({
    "canceled",
    "not_found",
    "payment_not_completed",
    "refunded",
    "signature_mismatch",
    "verification_failed",
    "verification_pending",
    "expired",
    "needs_reconciliation",
    "unknown",
})

_ALLOWED_CALLBACK_SOURCES = frozenset({
    "success",
    "failure",
    "unknown",
})


def _safe_reason(reason: str) -> str:
    """
    Sanitize redirect reason: only allow allowlisted codes, fallback to 'unknown'.
    """
    cleaned = reason.strip().lower()
    return cleaned if cleaned in _ALLOWED_REASON_CODES else "unknown"


def _safe_callback_source(source: str) -> str:
    cleaned = source.strip().lower()
    return cleaned if cleaned in _ALLOWED_CALLBACK_SOURCES else "unknown"


# ============================================================================
# PAYMENT VIEWS
# ============================================================================

class EsewaPaymentInitiateView(APIView):
    """
    Initiate an eSewa payment for a booking.

    Returns the eSewa v2 form URL and all required form fields (including HMAC
    signature). The frontend must POST these fields to the returned form_url
    using a dynamically created HTML form — this redirects the user's browser
    to the eSewa hosted payment page.
    """
    permission_classes = [IsAuthenticated, IsTraveller]
    serializer_class = EsewaInitiateInputSerializer   # for drf-spectacular auto-schema

    @extend_schema(
        request=EsewaInitiateInputSerializer,
        responses={201: EsewaInitiateResponseSerializer},
    )
    def post(self, request):
        serializer = EsewaInitiateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        booking_id = serializer.validated_data["booking_id"]

        # Load booking — ownership check is here in the view (thin but necessary).
        try:
            booking = Booking.objects.get(pk=booking_id, traveller=request.user)
        except Booking.DoesNotExist:
            raise ServiceError("Booking not found.", status_code=404)

        attempt, form_data = PaymentService.initiate_esewa_payment(booking, request.user)

        out = EsewaInitiateResponseSerializer({
            "attempt_id": attempt.pk,
            "form_url": settings.ESEWA_PAYMENT_URL,
            "fields": form_data,
        })
        return Response(out.data, status=status.HTTP_201_CREATED)


class EsewaPaymentCallbackView(APIView):
    """
    eSewa callback redirect handler.

    eSewa redirects the user's browser here after payment completion (success or failure).
    This view MUST be:
    - authentication_classes = [] (no JWT required — browser redirect has no auth token)
    - permission_classes = [AllowAny] (explicitly permit unauthenticated)

    WHY: DRF only enforces CSRF for SessionAuthentication. Since DEFAULT_AUTHENTICATION_CLASSES
    is JWT-only (no SessionAuthentication), CSRF is not an issue. But explicitly clearing
    authentication_classes ensures this view does not accidentally pick up any future
    session-based auth. AllowAny lets the anonymous request through.

    Security:
    - Redirect ONLY to settings.FRONTEND_URL (never to a user-controlled URL)
    - reason= param is URL-encoded and from the _ALLOWED_REASON_CODES allowlist only
    - The callback ?data= param is used for correlation/logging ONLY
    - Actual payment finalization is based on the server-to-server Status Check API
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(exclude=True)
    def get(self, request, transaction_uuid):
        encoded_data = request.GET.get("data", "")
        frontend_url = settings.FRONTEND_URL
        callback_source = _safe_callback_source(request.GET.get("source", ""))

        try:
            attempt, success = PaymentService.process_esewa_callback(
                transaction_uuid=str(transaction_uuid),
                encoded_data=encoded_data,
            )
        except ServiceError:
            # Attempt not found — redirect to generic failure page.
            logger.warning(
                "eSewa callback: PaymentAttempt not found for transaction_uuid=%s",
                transaction_uuid,
            )
            return redirect(
                f"{frontend_url}/payment/failure?reason=unknown"
            )

        if success:
            return redirect(
                f"{frontend_url}/payment/success"
                f"?booking_id={attempt.booking_id}"
                f"&attempt_id={attempt.pk}"
            )

        if attempt.status == AttemptStatus.PENDING:
            # Payment is still pending — redirect to a processing/waiting page.
            # The frontend should poll /api/payments/attempts/<id>/status/ here.
            return redirect(
                f"{frontend_url}/payment/processing"
                f"?attempt_id={attempt.pk}"
            )

        # Payment failed — redirect with allowlisted reason code.
        reason_code = _safe_reason(_get_failure_reason_code(
            attempt,
            callback_source=callback_source,
        ))
        return redirect(
            f"{frontend_url}/payment/failure"
            f"?booking_id={attempt.booking_id}"
            f"&attempt_id={attempt.pk}"
            f"&reason={url_quote(reason_code)}"
        )


class PaymentAttemptStatusView(APIView):
    """
    Poll the status of a payment attempt.

    Used by the frontend processing page to poll for payment confirmation.
    Returns the current attempt status so the frontend can decide when to
    show success or failure.

    Polling is safe (read-only, idempotent). No side effects.
    """
    permission_classes = [IsAuthenticated, IsTraveller]
    serializer_class = PaymentAttemptStatusSerializer  # for drf-spectacular auto-schema

    @extend_schema(
        responses={200: PaymentAttemptStatusSerializer},
    )
    def get(self, request, attempt_id):
        attempt = PaymentService.get_attempt_status(attempt_id, request.user)
        out = PaymentAttemptStatusSerializer(attempt)
        return Response(out.data)
    

class PaymentDetailView(APIView):
    """
    Retrieve confirmed payment details for the order confirmation / receipt page.

    Only returns payments owned by the requesting user.
    """
    permission_classes = [IsAuthenticated, IsTraveller]
    serializer_class = PaymentSerializer  # for drf-spectacular auto-schema

    @extend_schema(
        responses={200: PaymentSerializer},
    )
    def get(self, request, payment_id):
        payment = PaymentService.get_payment_detail(payment_id, request.user)
        out = PaymentSerializer(payment)
        return Response(out.data)
    
