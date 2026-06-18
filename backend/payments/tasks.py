import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(
    name="payments.tasks.expire_stale_payment_attempts",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def expire_stale_payment_attempts(self):
    """
    Periodic task: expire PaymentAttempt records stuck in INITIATED or PENDING.

    Run every 5 minutes via Celery beat (see settings.py CELERY_BEAT_SCHEDULE).

    An attempt is "stale" if it has been INITIATED or PENDING for more than
    30 minutes without being verified or explicitly failed.

    Strategy: fetch stale IDs first, then process each with skip_locked=True
    (same pattern as bookings.services.booking_service.expire_stale_bookings).
    """
    from django.db import transaction
    from .models import PaymentAttempt, AttemptStatus

    now = timezone.now()
    cutoff = now - timezone.timedelta(minutes=30)

    stale_ids = list(
        PaymentAttempt.objects.filter(
            status__in=[AttemptStatus.INITIATED, AttemptStatus.PENDING],
            created_at__lte=cutoff,
        ).values_list("id", flat=True)
    )

    expired_count = 0
    for attempt_id in stale_ids:
        try:
            with transaction.atomic():
                attempt = PaymentAttempt.objects.select_for_update(
                    skip_locked=True
                ).get(
                    pk=attempt_id,
                    status__in=[AttemptStatus.INITIATED, AttemptStatus.PENDING],
                    created_at__lte=cutoff,
                )
                attempt.status = AttemptStatus.EXPIRED
                attempt.failure_reason = "Expired: no payment received within 30 minutes."
                attempt.save(update_fields=["status", "failure_reason", "updated_at"])
                expired_count += 1
        except PaymentAttempt.DoesNotExist:
            pass  # Already handled by another worker or status changed

    logger.info("expire_stale_payment_attempts: expired %d attempts", expired_count)
    return {"expired": expired_count}


@shared_task(
    name="payments.tasks.verify_pending_payment",
    bind=True,
    max_retries=5,
    default_retry_delay=120,  # Retry every 2 minutes
)
def verify_pending_payment(self, attempt_id: int):
    """
    One-off task: re-check eSewa Status API for a PENDING payment attempt.

    Triggered when:
    - process_esewa_callback() receives PENDING or AMBIGUOUS from eSewa
    - process_esewa_callback() encounters a network error calling Status Check API
    - Safety net for missed callbacks (called manually or via admin action)

    If the status is now COMPLETE → finalizes payment + booking.
    If still PENDING/AMBIGUOUS → reschedule via self.retry().
    If FAILED → marks attempt FAILED.
    If max_retries exceeded → marks attempt FAILED with "max retries exceeded".
    """
    from django.conf import settings
    from .models import PaymentAttempt, AttemptStatus
    from .services.esewa_service import EsewaService, EsewaServiceError
    from .services.payment_service import PaymentService
    from bookings.services.booking_service import handle_payment_update

    try:
        attempt = PaymentAttempt.objects.select_related("booking", "user").get(
            pk=attempt_id
        )
    except PaymentAttempt.DoesNotExist:
        logger.error("verify_pending_payment: PaymentAttempt %d not found", attempt_id)
        return {"error": f"PaymentAttempt {attempt_id} not found"}

    # Skip if already in terminal state.
    if attempt.status in (
        AttemptStatus.VERIFIED,
        AttemptStatus.FAILED,
        AttemptStatus.EXPIRED,
        AttemptStatus.NEEDS_RECONCILIATION,
    ):
        logger.info(
            "verify_pending_payment: attempt %d already in terminal state %s (skip)",
            attempt_id, attempt.status,
        )
        return {"skipped": True, "status": attempt.status}

    logger.info(
        "verify_pending_payment: checking attempt %d (retry %d/%d)",
        attempt_id, self.request.retries, self.max_retries,
    )

    try:
        status_result = EsewaService.verify_transaction_status(
            product_code=settings.ESEWA_PRODUCT_CODE,
            total_amount=attempt.amount_str,
            transaction_uuid=attempt.transaction_uuid,
        )
    except EsewaServiceError as e:
        logger.warning(
            "verify_pending_payment: Status Check failed for attempt %d: %s. "
            "Retrying (attempt %d/%d).",
            attempt_id, e, self.request.retries + 1, self.max_retries,
        )
        try:
            raise self.retry(exc=e)
        except self.MaxRetriesExceededError:
            attempt.status = AttemptStatus.FAILED
            attempt.failure_reason = f"Max retries exceeded. Last error: {e}"
            attempt.save(update_fields=["status", "failure_reason", "updated_at"])
            logger.error(
                "verify_pending_payment: max retries exceeded for attempt %d. "
                "Marked FAILED. Manual review required.",
                attempt_id,
            )
            return {"failed": True, "reason": "max_retries_exceeded"}

    gateway_status = status_result["status"]
    ref_id = status_result["ref_id"]
    transaction_code = status_result["transaction_code"]

    if gateway_status == "COMPLETE":
        finalized_attempt, success = PaymentService._finalize_successful_payment(
            attempt=attempt,
            ref_id=ref_id,
            transaction_code=transaction_code,
            raw_response=status_result["raw"],
            handle_payment_update=handle_payment_update,
        )
        logger.info(
            "verify_pending_payment: processed COMPLETE for attempt %d (success=%s status=%s)",
            attempt_id, success, finalized_attempt.status,
        )
        return {"finalized": success, "status": finalized_attempt.status}

    elif gateway_status in ("PENDING", "AMBIGUOUS"):
        attempt.raw_response = status_result["raw"]
        attempt.save(update_fields=["raw_response", "updated_at"])
        logger.info(
            "verify_pending_payment: still PENDING for attempt %d. "
            "Retrying (attempt %d/%d).",
            attempt_id, self.request.retries + 1, self.max_retries,
        )
        try:
            raise self.retry(countdown=120)
        except self.MaxRetriesExceededError:
            attempt.status = AttemptStatus.FAILED
            attempt.failure_reason = "Max retries exceeded while PENDING. Manual review required."
            attempt.save(update_fields=["status", "failure_reason", "raw_response", "updated_at"])
            logger.error(
                "verify_pending_payment: max retries exceeded for attempt %d (still PENDING). "
                "Marked FAILED. Manual review required.",
                attempt_id,
            )
            return {"failed": True, "reason": "max_retries_exceeded_pending"}

    else:
        attempt.status = AttemptStatus.FAILED
        attempt.failure_reason = f"eSewa gateway status: {gateway_status}"
        attempt.raw_response = status_result["raw"]
        attempt.save(update_fields=["status", "failure_reason", "raw_response", "updated_at"])
        logger.info(
            "verify_pending_payment: attempt %d marked FAILED (gateway_status=%s)",
            attempt_id, gateway_status,
        )
        return {"failed": True, "status": gateway_status}
