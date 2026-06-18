import logging
import uuid as uuid_module

from django.db import transaction, IntegrityError
from django.utils import timezone
from django.conf import settings

from bookings.models import Booking, BookingStatus
from utils.exceptions import ServiceError
from ..models import PaymentAttempt, Payment, PaymentProvider, AttemptStatus
from .esewa_service import EsewaService, EsewaServiceError

logger = logging.getLogger(__name__)


def _get_failure_reason_code(attempt: PaymentAttempt, callback_source: str = "unknown") -> str:
    """
    Map a failed PaymentAttempt to an allowlisted reason code for redirect URLs.

    ONLY these values will ever appear in redirect URLs — never raw eSewa text.
    """
    if attempt.status == AttemptStatus.EXPIRED:
        return "expired"
    if attempt.status == AttemptStatus.NEEDS_RECONCILIATION:
        return "needs_reconciliation"
    if attempt.status == AttemptStatus.PENDING:
        return "verification_pending"

    reason = (attempt.failure_reason or "").upper()
    if callback_source == "failure" and (
        "NOT_FOUND" in reason or "CANCELED" in reason
    ):
        return "payment_not_completed"
    if "CANCELED" in reason:
        return "canceled"
    if "NOT_FOUND" in reason:
        return "not_found"
    if "REFUND" in reason:
        return "refunded"
    if "SIGNATURE" in reason:
        return "signature_mismatch"
    return "unknown"


class PaymentService:
    """
    Provider-agnostic payment orchestration.

    Views call this class. This class delegates to provider-specific services
    (EsewaService) and the booking system (booking_service.handle_payment_update).

    Booking state is NEVER modified here directly — always via booking_service.
    """

    @staticmethod
    @transaction.atomic
    def initiate_esewa_payment(booking: Booking, user) -> tuple:
        """
        Create a PaymentAttempt and generate eSewa v2 form fields.

        Validations:
        - Booking belongs to the requesting user
        - Booking is in PENDING_PAYMENT state
        - Booking has not yet expired (expires_at not in the past)
        - No existing INITIATED or PENDING attempt for this booking

        The partial UniqueConstraint on PaymentAttempt provides DB-level enforcement
        for the last rule. The service-level check + select_for_update provides
        application-level enforcement and a clean 409 error response.

        Args:
            booking: Booking instance (pre-loaded from view — ownership already checked).
            user: Authenticated Account instance.

        Returns:
            (attempt: PaymentAttempt, form_data: dict)
            form_data contains all eSewa v2 form fields ready for frontend use.

        Raises:
            ServiceError: 400 if booking not in payable state or already expired.
            ServiceError: 409 if an active attempt already exists.
        """
        # Lock the booking row to prevent race conditions on concurrent requests.
        booking = Booking.objects.select_for_update().get(pk=booking.pk)

        if booking.status != BookingStatus.PENDING_PAYMENT:
            raise ServiceError(
                f"Booking is not in a payable state (current status: {booking.status}). "
                "Only PENDING_PAYMENT bookings can be paid.",
                code="invalid_booking_state",
                status_code=400,
            )

        if booking.is_expired:
            raise ServiceError(
                "This booking's payment window has expired. Please create a new booking.",
                code="booking_expired",
                status_code=400,
            )

        # Service-level check for existing active attempt.
        # The DB-level partial unique constraint provides the final backstop,
        # but this gives a clean error message before hitting the DB constraint.
        existing_attempt = PaymentAttempt.objects.filter(
            booking=booking,
            status__in=[AttemptStatus.INITIATED, AttemptStatus.PENDING],
        ).first()

        if existing_attempt:
            raise ServiceError(
                "An active payment attempt already exists for this booking. "
                "Complete or wait for the existing attempt to expire before retrying.",
                code="active_attempt_exists",
                status_code=409,
            )


        # Generate a UUID for this payment attempt.
        # This UUID is sent to eSewa and echoed back in the callback URL path, allowing us to look up this attempt without any session or auth token.
        transaction_uuid = str(uuid_module.uuid4())

        # amount_str: the canonical string representation of the payment amount.
        # THIS EXACT STRING must be used in:
        #   1. The HMAC-SHA256 signature message
        #   2. The eSewa form field "total_amount"
        #   3. The Status Check API query param "total_amount"
        # Any deviation causes "Signature Mismatch" errors.
        amount_str = "{:.2f}".format(booking.quoted_total)

        try:
            attempt = PaymentAttempt.objects.create(
                booking=booking,
                user=user,
                provider=PaymentProvider.ESEWA,
                transaction_uuid=transaction_uuid,
                expected_amount=booking.quoted_total,
                amount_str=amount_str,
                status=AttemptStatus.INITIATED,
            )
        except IntegrityError:
            # Race condition: another concurrent request created an attempt
            # between our check and our create. The partial unique constraint fired.
            raise ServiceError(
                "A concurrent payment attempt was just created for this booking. "
                "Please try again.",
                code="active_attempt_exists",
                status_code=409,
            )
        
        form_data = EsewaService.build_form_fields(attempt)

        logger.info(
            "PaymentAttempt created: id=%s booking=%s transaction_uuid=%s amount=%s",
            attempt.pk, booking.pk, transaction_uuid, amount_str,
        )

        return attempt, form_data

    
    @staticmethod
    def process_esewa_callback(transaction_uuid: str, encoded_data: str) -> tuple:
        """
        Process eSewa's callback redirect for a payment attempt.

        This is called when eSewa redirects the browser to the callback URL.
        The browser brings a ?data=<base64> query param.

        SECURITY MODEL:
        - Redirect ?data= is decoded for correlation/logging only.
        - Payment finalization ALWAYS depends on the server-to-server Status Check API.
          This prevents a signed redirect payload for one attempt from being replayed
          against a different callback URL path.
        - This method is idempotent: double callbacks for the same transaction are no-ops.

        Status handling (all cases from eSewa docs):
        - COMPLETE       → Create Payment, call handle_payment_update(payment_succeeded)
        - PENDING        → Mark PENDING, schedule Celery retry
        - AMBIGUOUS      → Same as PENDING (normalizes AMBIGIOUS typo)
        - CANCELED       → Mark FAILED
        - NOT_FOUND      → Mark FAILED
        - FULL_REFUND    → Mark FAILED
        - PARTIAL_REFUND → Mark FAILED

        Args:
            transaction_uuid: From the callback URL path (looked up attempt by this UUID).
            encoded_data: Raw ?data= query parameter from eSewa redirect. May be empty.

        Returns:
            (attempt: PaymentAttempt, success: bool)
            success=True  → payment verified, booking confirmed
            success=False → payment failed or still pending

        Raises:
            ServiceError: 404 if no PaymentAttempt found for this transaction_uuid.
        """
        # Import here to avoid circular import at module load time.
        from bookings.services.booking_service import handle_payment_update
        # --- Load PaymentAttempt ---
        try:
            attempt = PaymentAttempt.objects.select_related(
                "booking", "user"
            ).get(transaction_uuid=transaction_uuid)
        except PaymentAttempt.DoesNotExist:
            logger.error(
                "PaymentAttempt not found for transaction_uuid=%s", transaction_uuid
            )
            raise ServiceError("Payment attempt not found.", status_code=404)

        # --- Idempotency / terminal handling ---
        if attempt.status == AttemptStatus.VERIFIED:
            logger.info(
                "Callback received for already-verified attempt %s (idempotent no-op)",
                attempt.pk,
            )
            return attempt, True

        if attempt.status in (AttemptStatus.FAILED, AttemptStatus.NEEDS_RECONCILIATION):
            logger.info(
                "Callback received for terminal attempt %s (status=%s, no-op)",
                attempt.pk, attempt.status,
            )
            return attempt, False

        # --- Decode and verify callback ?data= for logging only ---
        callback_data = EsewaService.decode_callback_data(encoded_data) if encoded_data else {}

        if callback_data:
            callback_status = callback_data.get("status", "")
            signed_field_names = callback_data.get("signed_field_names", "")
            callback_signature = callback_data.get("signature", "")

            logger.info(
                "eSewa callback data for attempt %s: status=%s uuid=%s",
                attempt.pk,
                callback_status,
                callback_data.get("transaction_uuid"),
            )

            if signed_field_names and callback_signature:
                fields = [f.strip() for f in signed_field_names.split(",")]
                message = ",".join(
                    f"{f}={callback_data.get(f, '')}" for f in fields
                )
                signature_valid = EsewaService.verify_signature(message, callback_signature)
            else:
                signature_valid = False

            if not signature_valid:
                logger.warning(
                    "Callback signature MISMATCH for attempt %s. "
                    "Ignoring redirect payload and relying on Status Check API.",
                    attempt.pk,
                )
            elif callback_data.get("transaction_uuid") != attempt.transaction_uuid:
                logger.warning(
                    "Callback correlation mismatch for attempt %s: payload_uuid=%s path_uuid=%s. "
                    "Ignoring redirect payload and relying on Status Check API.",
                    attempt.pk,
                    callback_data.get("transaction_uuid"),
                    attempt.transaction_uuid,
                )
            elif callback_status == "COMPLETE":
                logger.info(
                    "eSewa callback reported COMPLETE for attempt %s. "
                    "Verifying with Status Check API before finalization.",
                    attempt.pk,
                )
        else:
            logger.info(
                "No callback data for attempt %s (failure redirect with no ?data=). "
                "Falling through to Status Check API.",
                attempt.pk,
            )

        # --- Status Check API — authoritative source of truth ---
        try:
            status_result = EsewaService.verify_transaction_status(
                product_code=settings.ESEWA_PRODUCT_CODE,
                total_amount=attempt.amount_str,
                transaction_uuid=attempt.transaction_uuid,
            )
        except EsewaServiceError as e:
            if attempt.status == AttemptStatus.EXPIRED:
                logger.error(
                    "eSewa Status Check failed for expired attempt %s: %s. "
                    "Leaving attempt EXPIRED for manual follow-up if needed.",
                    attempt.pk, e,
                )
                return attempt, False
            logger.error(
                "eSewa Status Check failed for attempt %s: %s. Marking PENDING + scheduling retry.",
                attempt.pk, e,
            )
            attempt.status = AttemptStatus.PENDING
            attempt.save(update_fields=["status", "updated_at"])
            # Schedule a retry in 60 seconds.
            from payments.tasks import verify_pending_payment
            verify_pending_payment.apply_async((attempt.pk,), countdown=60)
            return attempt, False

        gateway_status = status_result["status"]
        ref_id = status_result["ref_id"]
        transaction_code = status_result["transaction_code"]

        # --- Handle each eSewa status ---

        if gateway_status == "COMPLETE":
            return PaymentService._finalize_successful_payment(
                attempt=attempt,
                ref_id=ref_id,
                transaction_code=transaction_code,
                raw_response=status_result["raw"],
                handle_payment_update=handle_payment_update,
            )

        elif gateway_status in ("PENDING", "AMBIGUOUS"):
            if attempt.status == AttemptStatus.EXPIRED:
                logger.info(
                    "Expired attempt %s is still %s at the gateway. Keeping EXPIRED.",
                    attempt.pk, gateway_status,
                )
                attempt.raw_response = status_result["raw"]
                attempt.save(update_fields=["raw_response", "updated_at"])
                return attempt, False
            attempt.status = AttemptStatus.PENDING
            attempt.raw_response = status_result["raw"]
            attempt.save(update_fields=["status", "raw_response", "updated_at"])
            logger.info(
                "eSewa payment PENDING for attempt %s (gateway_status=%s). "
                "Scheduling retry in 120s.",
                attempt.pk, gateway_status,
            )
            from payments.tasks import verify_pending_payment
            verify_pending_payment.apply_async((attempt.pk,), countdown=120)
            return attempt, False

        else:
            # CANCELED, NOT_FOUND, FULL_REFUND, PARTIAL_REFUND
            attempt.status = AttemptStatus.FAILED
            attempt.failure_reason = f"eSewa gateway status: {gateway_status}"
            attempt.raw_response = status_result["raw"]
            attempt.save(update_fields=[
                "status", "failure_reason", "raw_response", "updated_at"
            ])
            logger.info(
                "eSewa payment failed for attempt %s: gateway_status=%s",
                attempt.pk, gateway_status,
            )
            return attempt, False
        
    
    @staticmethod
    def get_attempt_status(attempt_pk: int, user) -> PaymentAttempt:
        """
        Retrieve a PaymentAttempt for status polling.

        Validates that the requesting user owns the attempt.

        Args:
            attempt_pk: PaymentAttempt primary key.
            user: Authenticated Account instance.

        Returns:
            PaymentAttempt instance.

        Raises:
            ServiceError: 404 if not found or user doesn't own it.
        """
        try:
            return PaymentAttempt.objects.get(pk=attempt_pk, user=user)
        except PaymentAttempt.DoesNotExist:
            raise ServiceError("Payment attempt not found.", status_code=404)

    @staticmethod
    def get_payment_detail(payment_pk: int, user) -> Payment:
        """
        Retrieve a confirmed Payment for the receipt/order confirmation page.

        Args:
            payment_pk: Payment primary key.
            user: Authenticated Account instance.

        Returns:
            Payment instance.

        Raises:
            ServiceError: 404 if not found or user doesn't own it.
        """
        try:
            return Payment.objects.select_related("booking").get(
                pk=payment_pk, user=user
            )
        except Payment.DoesNotExist:
            raise ServiceError("Payment not found.", status_code=404)
    
    # -------------------------------------------------------------------------
    # Private helpers
    # -------------------------------------------------------------------------

    @staticmethod
    @transaction.atomic
    def _finalize_successful_payment(
        attempt: PaymentAttempt,
        ref_id: str,
        transaction_code: str,
        raw_response: dict,
        handle_payment_update,
    ) -> tuple:
        """
        Atomically finalize a successful eSewa payment.

        Wrapped in transaction.atomic + select_for_update to handle the race
        where two concurrent callbacks both receive COMPLETE from the Status Check API.

        Steps:
        1. Lock the PaymentAttempt row with select_for_update
        2. Re-check status (another worker may have already finalized)
        3. Create Payment record (UniqueConstraint on gateway_transaction_code
           provides final dedup backstop via IntegrityError catch)
        4. Update PaymentAttempt to VERIFIED
        5. Call handle_payment_update() to finalize the Booking

        Returns:
            (attempt: PaymentAttempt, success=True) when booking confirmation succeeded.
            (attempt: PaymentAttempt, success=False) when payment is real but manual
            reconciliation is required because the booking was already terminal.
        """
        now = timezone.now()

        # Re-lock the attempt inside the transaction.
        attempt_locked = PaymentAttempt.objects.select_for_update().get(pk=attempt.pk)

        # Race condition guard: another worker finalized this while we were checking.
        if attempt_locked.status == AttemptStatus.VERIFIED:
            logger.info(
                "Attempt %s already VERIFIED by concurrent worker (idempotent)",
                attempt.pk,
            )
            return attempt_locked, True

        # Determine the gateway_transaction_code for the Payment record.
        # eSewa's ref_id is their guaranteed-unique transaction reference.
        # Fallback to transaction_code, then to a derived value.
        gateway_txn_code = (
            ref_id
            or transaction_code
            or f"esewa_{attempt_locked.transaction_uuid}"
        )

        # Create the Payment record.
        # The UniqueConstraint on gateway_transaction_code catches any double-creation.
        try:
            payment = Payment.objects.create(
                attempt=attempt_locked,
                booking=attempt_locked.booking,
                user=attempt_locked.user,
                amount=attempt_locked.expected_amount,
                provider=attempt_locked.provider,
                gateway_transaction_code=gateway_txn_code,
                paid_at=now,
            )
            logger.info(
                "Payment record created: id=%s booking=%s amount=%s ref_id=%s",
                payment.pk, attempt_locked.booking_id,
                attempt_locked.expected_amount, gateway_txn_code,
            )
        except IntegrityError:
            # Payment already exists — another concurrent worker beat us.
            # Refresh the attempt and reflect the already-persisted terminal state.
            logger.warning(
                "Payment already exists for gateway_txn_code=%s (attempt %s). "
                "Double callback race resolved.",
                gateway_txn_code, attempt.pk,
            )
            attempt_locked.refresh_from_db()
            return attempt_locked, attempt_locked.status == AttemptStatus.VERIFIED

        # --- Finalize the Booking via booking_service ---
        # This is the ONLY place outside booking_service that triggers a booking
        # state transition. handle_payment_update() is idempotent via ProcessedPaymentEvent.
        #
        # event_id = eSewa's ref_id (unique per transaction).
        # ProcessedPaymentEvent.event_id unique constraint ensures that even if
        # handle_payment_update() is somehow called twice with the same ref_id,
        # the second call is a no-op.
        event_id = ref_id or f"esewa_{attempt_locked.transaction_uuid}"

        booking = handle_payment_update(
            booking_id=attempt_locked.booking_id,
            provider="esewa",
            payment_intent_ref=attempt_locked.transaction_uuid,
            transaction_id=transaction_code or ref_id,
            amount=attempt_locked.expected_amount,
            currency="NPR",
            status="payment_succeeded",
            event_id=event_id,
        )

        if booking.status in (BookingStatus.CONFIRMED, BookingStatus.COMPLETED):
            attempt_locked.status = AttemptStatus.VERIFIED
            success = True
            failure_reason = ""
        else:
            attempt_locked.status = AttemptStatus.NEEDS_RECONCILIATION
            success = False
            failure_reason = (
                "Gateway confirmed payment after booking reached terminal state. "
                "Manual reconciliation required."
            )

        attempt_locked.verified_at = now
        attempt_locked.gateway_transaction_code = gateway_txn_code
        attempt_locked.raw_response = raw_response
        attempt_locked.failure_reason = failure_reason
        attempt_locked.save(update_fields=[
            "status", "verified_at", "gateway_transaction_code",
            "raw_response", "failure_reason", "updated_at",
        ])

        logger.info(
            "Booking payment processed via handle_payment_update: "
            "attempt=%s booking=%s event_id=%s attempt_status=%s",
            attempt_locked.pk, attempt_locked.booking_id, event_id, attempt_locked.status,
        )

        return attempt_locked, success
