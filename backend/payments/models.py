import uuid as uuid_module
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q

# ENUMS 

class PaymentProvider(models.TextChoices):
    """
    Payment provider choices. Must match bookings.models.PaymentProvider values.
    """
    ESEWA = "esewa", "eSewa"
    STRIPE = "stripe", "Stripe"


class AttemptStatus(models.TextChoices):
    INITIATED = "initiated", "Initiated"   # Form fields generated; user about to pay on eSewa
    PENDING   = "pending",   "Pending"     # eSewa returned PENDING or AMBIGUOUS; waiting
    VERIFIED  = "verified",  "Verified"    # Status check confirmed COMPLETE; booking finalized
    FAILED    = "failed",    "Failed"      # CANCELED / NOT_FOUND / FULL_REFUND / PARTIAL_REFUND
    EXPIRED   = "expired",   "Expired"     # Attempt too old; expired by Celery task
    NEEDS_RECONCILIATION = "needs_reconciliation", "Needs Reconciliation"  # Gateway confirmed payment after booking became terminal


# MODELS

class PaymentAttempt(models.Model):
    """
    Records each attempt to pay for a booking via any payment provider.

    Lifecycle:
        INITIATED → (status check) → VERIFIED              (success)
                                   → FAILED                (canceled/not found/refund)
                                   → PENDING               (status check inconclusive; retry scheduled)
                                   → NEEDS_RECONCILIATION  (gateway says paid, but booking already terminal)
        Any state → EXPIRED        (Celery task after 30 min)

    Key design decisions:
    - transaction_uuid: UUID generated server-side, sent to eSewa as their transaction_uuid.
      Used in callback URL for correlation. NOT the model PK.
    - amount_str: Exact string representation of total_amount. Stored once and reused
      identically for: HMAC signature, eSewa form field, and Status Check API query param.
      Prevents "sign 1000 but check with 1000.00" mismatches.
    - Partial UniqueConstraint enforces one active attempt per booking at DB level.
    """
    booking = models.ForeignKey(
        "bookings.Booking",
        on_delete=models.CASCADE,
        related_name="payment_attempts",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payment_attempts",
    )

    provider = models.CharField(
        max_length=20,
        choices=PaymentProvider.choices,
        default=PaymentProvider.ESEWA,
    )

    transaction_uuid = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text=(
            "UUID sent to eSewa as their transaction_uuid. "
            "Used in callback URL path for correlation. "
            "This is the external-facing identifier — NOT the model PK."
        ),
    )

    expected_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="The booking's quoted_total at the time of this attempt.",
    )

    amount_str = models.CharField(
        max_length=20,
        help_text=(
            "Exact string representation of total_amount sent to eSewa "
            "(e.g. '1180.00'). Reused identically for HMAC signature, "
            "form field, and Status Check API query param. "
            "Prevents Decimal/string/trailing-zero mismatches."
        ),
    )

    status = models.CharField(
        max_length=20,
        choices=AttemptStatus.choices,
        default=AttemptStatus.INITIATED,
        db_index=True,
    )

    gateway_transaction_code = models.CharField(
        max_length=255,
        blank=True,
        help_text="eSewa's transaction_code from the Status Check API response.",
    )

    raw_response = models.JSONField(
        default=dict,
        help_text="Raw eSewa Status Check API response for debugging/audit.",
    )

    failure_reason = models.TextField(
        blank=True,
        help_text="Human-readable failure reason for debugging.",
    )

    verified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when Status Check API confirmed COMPLETE.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["booking", "status"]),
            models.Index(fields=["transaction_uuid"]),
        ]
        constraints = [
            # Partial unique constraint: only one INITIATED or PENDING attempt per booking.
            # Prevents two browser tabs from creating two concurrent active attempts.
            # PostgreSQL feature — works because the project uses PostgreSQL.
            models.UniqueConstraint(
                fields=["booking"],
                condition=Q(status__in=["initiated", "pending"]),
                name="one_active_attempt_per_booking",
            ),
        ]

    def __str__(self):
        return f"PaymentAttempt #{self.pk} [{self.provider}] {self.status} — Booking {self.booking_id}"
     

class Payment(models.Model):
    """
    Confirmed, successful payment record. Created ONLY when Status Check API returns COMPLETE.

    The gateway_transaction_code unique constraint is the dedup key:
    if eSewa somehow triggers two COMPLETE events for the same transaction,
    the second Payment.objects.create() will raise IntegrityError, which
    payment_service.py catches and handles gracefully.
    """
    attempt = models.OneToOneField(
        PaymentAttempt,
        on_delete=models.PROTECT,
        related_name="payment",
    )

    booking = models.ForeignKey(
        "bookings.Booking",
        on_delete=models.PROTECT,
        related_name="payments",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="payments",
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    provider = models.CharField(
        max_length=20,
        choices=PaymentProvider.choices,
    )

    gateway_transaction_code = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text=(
            "eSewa's ref_id from Status Check API. "
            "UNIQUE constraint prevents double Payment records "
            "if two concurrent callbacks both reach COMPLETE handling."
        ),
    )

    paid_at = models.DateTimeField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["booking"]),
        ]

    def __str__(self):
        return f"Payment #{self.pk} [{self.provider}] {self.amount} NPR — Booking {self.booking_id}"
    
