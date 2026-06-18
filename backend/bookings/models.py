from decimal import Decimal
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

# ENUMS

class BookingStatus(models.TextChoices):
    PENDING_PAYMENT = "pending_payment", "Pending Payment"
    CONFIRMED = "confirmed", "Confirmed"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"
    EXPIRED = "expired", "Expired"


class BookingItemStatus(models.TextChoices):
    PENDING_PAYMENT = "pending_payment", "Pending Payment"
    CONFIRMED = "confirmed", "Confirmed"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"
    EXPIRED = "expired", "Expired"


class PaymentStatus(models.TextChoices):
    PAYMENT_PENDING = "payment_pending", "Payment Pending"
    PAYMENT_SUCCEEDED = "payment_succeeded", "Payment Succeeded"
    PAYMENT_FAILED = "payment_failed", "Payment Failed"
    PAYMENT_REFUNDED = "payment_refunded", "Payment Refunded"
    PAYMENT_PARTIALLY_REFUNDED = "payment_partially_refunded", "Partially Refunded"
    PAYMENT_CANCELLED = "payment_cancelled", "Payment Cancelled"


class PaymentProvider(models.TextChoices):
    ESEWA = "esewa",   "eSewa"
    STRIPE = "stripe",  "Stripe"
    OFFLINE = "offline", "Offline / Manual"


class BookingSource(models.TextChoices):
    DIRECT = "direct", "Direct"
    TRIP_PLAN = "trip_plan", "From Trip Plan"
    ADMIN = "admin", "Admin Created"


class CancellationReason(models.TextChoices):
    TRAVELLER_REQUEST = "traveller_request", "Traveller Request"
    HOST_UNAVAILABLE  = "host_unavailable", "Host Unavailable"
    PAYMENT_FAILED = "payment_failed", "Payment Failed"
    PAYMENT_REFUNDED = "payment_refunded", "Payment Refunded"  
    PAYMENT_CANCELLED  = "payment_cancelled", "Payment Cancelled"
    ADMIN_ACTION = "admin_action", "Admin Action"
    OTHER = "other", "Other"


# MODELS 

class AvailabilityHold(models.Model):
    """
    Pessimistic lock on a listing's time slot during payment processing.

    Created when a BookingItem is created; released on payment success/failure/expiry.
    """
    listing = models.ForeignKey(
        "listings.Listing",
        on_delete=models.CASCADE,
        related_name="holds",
    )

    traveller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="holds",
    )

    # Schedule for BookingItem - Denormalization
    duration_type = models.CharField(max_length=20)

    start_date = models.DateField(null=True, blank=True)

    end_date = models.DateField(null=True, blank=True)

    start_time = models.TimeField(null=True, blank=True)

    end_time = models.TimeField(null=True, blank=True)

    traveller_count = models.PositiveIntegerField(default=1)

    expires_at = models.DateTimeField(db_index=True)

    is_released = models.BooleanField(default=False, db_index=True)

    released_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)


    class Meta:
        indexes = [
            models.Index(fields=['listing', 'start_date', 'end_date']),
            models.Index(fields=['listing', 'start_date', 'start_time']),
            models.Index(fields=['expires_at', 'is_released']),
        ]

    def __str__(self):
        return f"Hold #{self.pk} - Listing {self.listing_id} [{self.start_date}→{self.end_date}]"
    
    def release(self):
        if not self.is_released:
            self.is_released = True
            self.released_at = timezone.now()
            self.save(update_fields=['is_released', 'released_at'])


class Booking(models.Model):
    """
    Container. One booking can hold multiple BookingItems across different hosts.

    Payment is at this level; individual item status follows payment outcome.
    """
    reference = models.CharField(
        max_length=25, unique=True, editable=False,
        null=True, blank=True,
        help_text="Set from PK after insert: BK-YYYYMMDD-{id:06d}. Null only for the instant between create and update.",
    )

    traveller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="bookings",
    )

    trip_plan = models.ForeignKey(
        "trip_planner.TripPlanner",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="bookings",
    )

    source = models.CharField(
        max_length=20,
        choices=BookingSource.choices,
        default=BookingSource.DIRECT,
    )

    status = models.CharField(
        max_length=20,
        choices=BookingStatus.choices,
        default=BookingStatus.PENDING_PAYMENT,
        db_index=True,
    )

    expires_at = models.DateTimeField(
        help_text="Payment deadline. After this the booking auto-expires.",
    )


    # payment reference fields: filled after payment is done. intially null
    payment_status = models.CharField(
        max_length=30,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PAYMENT_PENDING,
        db_index=True,
    )

    payment_provider = models.CharField(
        max_length=20,
        choices=PaymentProvider.choices,
        null=True, blank=True,
    )

    payment_intent_ref = models.CharField(
        max_length=255, 
        blank=True
    )

    transaction_id = models.CharField(
        max_length=255, 
        blank=True, 
        db_index=True
    )

    paid_amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        null=True,
        blank=True,
    )

    currency = models.CharField(
        max_length=5,
        default="NPR",
    )

    paid_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Set when payment succeeds. Null means payment never completed.",
    )

    last_payment_error = models.TextField(
        blank=True,
    )

    # Booking Totals (sum of booking items done at booking creation)
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2, 
        default=Decimal('0.00'),
    )

    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2, 
        default=Decimal('0.00'),
    )

    fee_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2, 
        default=Decimal('0.00'),
    )

    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2, 
        default=Decimal('0.00'),
    )

    gross_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2, 
        default=Decimal('0.00'),
    )

    quoted_total = models.DecimalField(
        max_digits=12,
        decimal_places=2, 
        default=Decimal('0.00'),
    )

    # Cancellation
    cancelled_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    cancellation_reason = models.CharField(
        max_length=30,
        choices=CancellationReason.choices,
        blank=True,
    )

    cancellation_note = models.TextField(blank=True)

    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="cancelled_bookings",
    )

    # Idempotency
    idempotency_key = models.CharField(
        max_length=255,
        blank=True,
        db_index=True,
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=["traveller", "status"]),
            models.Index(fields=["expires_at", "status"]),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["traveller", "idempotency_key"],
                condition=~Q(idempotency_key=""),
                name="unique_booking_idempotency_per_traveller",
            ),
        ]

    def __str__(self):
        return f"Booking {self.reference} ({self.traveller.email})"
    
    @property
    def is_expired(self) -> bool:
        return self.status == BookingStatus.PENDING_PAYMENT and timezone.now() > self.expires_at

    @property
    def all_items_completed(self) -> bool:
        return self.items.exists() and not self.items.exclude(
            status=BookingItemStatus.COMPLETED
        ).exists()


class BookingItem(models.Model):
    """
    A single listing reservation within a Booking.

    Hosts interact with BookingItems, not Bookings.
    """
    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='items',
    )

    listing = models.ForeignKey(
        "listings.Listing",
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="booking_items",
    )

    package = models.ForeignKey(
        "packages.Package",
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="booking_items",
    )

    package_slot = models.ForeignKey(
        "packages.PackageSlot",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="booking_items",
    )

    slot = models.ForeignKey(
        "listings.ActivitySlot",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="booking_items",
    )

    trip_plan_item = models.ForeignKey(
        "trip_planner.TripPlannerItem",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="booking_items",
    )

    # Schedule
    duration_type = models.CharField(max_length=20) # mirrors listings.DurationType

    start_date = models.DateField(
        null=True,
        blank=True,
    )

    end_date = models.DateField(
        null=True,
        blank=True,
    )

    start_time = models.TimeField(
        null=True,
        blank=True,
    ) # hourly only

    end_time = models.TimeField(
        null=True,
        blank=True,
    ) # hourly only

    days = models.PositiveIntegerField(default=1)

    nights = models.PositiveIntegerField(default=0)

    traveller_count = models.PositiveIntegerField(default=1)

    status = models.CharField(
        max_length=20,
        choices=BookingItemStatus.choices,
        default=BookingItemStatus.PENDING_PAYMENT,
        db_index=True,
    )

    # Snapshot (listing state frozen at booking creation time)
    snapshot = models.JSONField(
        default=dict,
        help_text=(
            "Frozen listing data at booking time. Keys: title, destination, "
            "price_per_person, duration_type, duration_days, duration_nights, "
            "cancellation_policy, host_name, primary_image_url"
        ),
    )

    # per item price breaking down 
    price_per_person = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    fee_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    tax_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    gross_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    quoted_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    currency = models.CharField(
        max_length=5,
        default="NPR",
    )

    # Hold (released after payment or cancellation)
    hold = models.OneToOneField(
        AvailabilityHold,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="booking_item",
    )

    # Timestamps 
    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["booking", "status"]),
            models.Index(fields=["listing", "status"]),
            models.Index(fields=["listing", "start_date", "end_date"]),
        ]
    
    def __str__(self):
        subject = self.listing.title if self.listing_id else f"Package #{self.package_id}"
        return f"Item #{self.pk} — {subject} [{self.booking.reference}]"


class BookingStatusHistory(models.Model):
    """
    Single model with nullable booking_item.
    - When booking_item is NULL  → Booking-level transition.
    - When booking_item is set   → BookingItem-level transition.

    Rationale: both have identical audit columns; avoids two parallel tables.
    """
    booking = models.ForeignKey(
        Booking, 
        on_delete=models.CASCADE, 
        related_name="history"
    )

    booking_item = models.ForeignKey(
        BookingItem,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="history",
    )

    from_status = models.CharField(max_length=30, blank=True)

    to_status = models.CharField(max_length=30)

    note = models.TextField(blank=True)

    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True, 
    )

    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["changed_at"]

    def __str__(self):
        target = f"Item #{self.booking_item_id}" if self.booking_item_id else "Booking"
        return f"{self.booking.reference} / {target}: {self.from_status}→{self.to_status}"
    

class ProcessedPaymentEvent(models.Model):
    """
    Records every payment event_id that has been processed.

    The payments/ app must check this before calling handle_payment_update().

    handle_payment_update() also checks before writing.
    """
    event_id = models.CharField(
        max_length=255, 
        unique=True
    )

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name="payment_events"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["booking"])]
    
    def __str__(self):
        return f"PaymentEvent {self.event_id} → Booking {self.booking.reference}"

