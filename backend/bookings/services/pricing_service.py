from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum
from django.utils import timezone

from listings.models import Listing, DurationType
from ..models import BookingItem, BookingItemStatus, BookingStatus

PLATFORM_FEE_RATE = Decimal("0.05")
VAT_RATE = Decimal("0.13")
HOLD_MINUTES = 15
ACTIVE_ITEM_STATUSES = [
    BookingItemStatus.PENDING_PAYMENT,
    BookingItemStatus.CONFIRMED,
]


def _check_slot_capacity(slot, requested_count: int, slot_field: str = "slot") -> bool:
    """
    Return True if the slot has room for requested_count more travellers.

    Counts only active (pending_payment or confirmed) items whose parent booking
    has not yet expired — this prevents stale pending items from blocking
    availability when the expiry worker is delayed (Bug 1 fix).

    Pass slot_field="package_slot" for package bookings.
    """
    now = timezone.now()
    booked = (
        BookingItem.objects
        .filter(**{slot_field: slot}, status__in=ACTIVE_ITEM_STATUSES)
        .exclude(booking__expires_at__lt=now)
        .exclude(booking__status=BookingStatus.EXPIRED)
        .aggregate(total=Sum("traveller_count"))["total"] or 0
    )
    return booked + requested_count <= slot.capacity


def _calculate_item_price(listing: Listing, traveller_count: int, schedule: dict) -> dict:
    """
    Compute per-item pricing breakdown.

    Pricing logic:
        - MULTI_DAY: subtotal = price_per_person × traveller_count × days
        - FULL_DAY:  subtotal = price_per_person × traveller_count
        - HOURLY:    subtotal = price_per_person × traveller_count  (price is per session)

    Then:
        - discount_amount = 0.00  (reserved for future promotions)
        - fee_amount      = subtotal × PLATFORM_FEE_RATE
        - tax_amount      = subtotal × VAT_RATE
        - gross_amount    = subtotal + fee_amount + tax_amount - discount_amount
    """
    price = listing.price_per_person
    count = Decimal(str(traveller_count))
    dtype = schedule["duration_type"]

    if dtype == DurationType.MULTI_DAY:
        multiplier = Decimal(str(max(schedule.get("days", 1), 1)))
    else:
        multiplier = Decimal("1")

    subtotal = (price * count * multiplier).quantize(Decimal("0.01"), ROUND_HALF_UP)
    discount_amount = Decimal("0.00")
    fee_amount = (subtotal * PLATFORM_FEE_RATE).quantize(Decimal("0.01"), ROUND_HALF_UP)
    tax_amount = (subtotal * VAT_RATE).quantize(Decimal("0.01"), ROUND_HALF_UP)
    gross_amount = subtotal + fee_amount + tax_amount - discount_amount

    return {
        "price_per_person": price,
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "fee_amount": fee_amount,
        "tax_amount": tax_amount,
        "gross_amount": gross_amount,
    }


def _calculate_package_price(package, traveller_count: int) -> dict:
    """
    Compute the pricing breakdown for a package booking.

    Differs from _calculate_item_price() in that no duration multiplier is
    applied — package.total_price is the host-defined per-person price for
    the entire package duration, so the duration is already baked in.

    Formula:
        subtotal     = total_price × traveller_count
        fee_amount   = subtotal × PLATFORM_FEE_RATE  (ROUND_HALF_UP)
        tax_amount   = subtotal × VAT_RATE            (ROUND_HALF_UP)
        gross_amount = subtotal + fee_amount + tax_amount
    """
    count = Decimal(str(traveller_count))
    subtotal = (package.total_price * count).quantize(Decimal("0.01"), ROUND_HALF_UP)
    discount = Decimal("0.00")
    fee_amount = (subtotal * PLATFORM_FEE_RATE).quantize(Decimal("0.01"), ROUND_HALF_UP)
    tax_amount = (subtotal * VAT_RATE).quantize(Decimal("0.01"), ROUND_HALF_UP)
    gross_amount = subtotal + fee_amount + tax_amount - discount

    return {
        "subtotal": subtotal,
        "discount_amount": discount,
        "fee_amount": fee_amount,
        "tax_amount": tax_amount,
        "gross_amount": gross_amount,
    }
