from collections import defaultdict
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from django.db import transaction, IntegrityError
from django.utils import timezone

from listings.models import Listing, ActivitySlot
from trip_planner.models import TripPlanner, TripPlannerItem, TripStatus
from utils.exceptions import ServiceError
from ..models import (
    Booking, BookingItem, AvailabilityHold,
    BookingStatusHistory,
    BookingStatus, BookingItemStatus, BookingSource,
)
from .pricing_service import HOLD_MINUTES, _check_slot_capacity, _calculate_item_price


# DTOs

@dataclass
class ItemQuote:
    listing_id: int
    listing_title: str
    duration_type: str
    start_date: object   # date or None
    end_date: object     # date or None
    days: int
    traveller_count: int
    price_per_person: Decimal
    subtotal: Decimal
    discount_amount: Decimal
    fee_amount: Decimal
    tax_amount: Decimal
    gross_amount: Decimal
    quoted_total: Decimal
    availability: str    # "available" | "conflict" | "unavailable"
    currency: str = "NPR"


@dataclass
class BookingQuoteResult:
    items: list
    subtotal: Decimal = Decimal("0")
    discount_amount: Decimal = Decimal("0")
    fee_amount: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")
    gross_amount: Decimal = Decimal("0")
    quoted_total: Decimal = Decimal("0")
    currency: str = "NPR"

    @property
    def totals(self) -> dict:
        """
        DRF's BookingQuoteResponseSerializer calls result.totals.
        This property makes the dataclass directly serializable without
        any extra dict construction in the view.
        """
        return {
            "subtotal": self.subtotal,
            "fee_amount": self.fee_amount,
            "tax_amount": self.tax_amount,
            "discount_amount": self.discount_amount,
            "gross_amount": self.gross_amount,
            "quoted_total": self.quoted_total,
            "currency": self.currency,
        }


# Public functions

def quote_booking(user, payload: dict) -> BookingQuoteResult:
    """
    Compute per-item price + availability without any DB write.

    Steps:
    - For each item in payload["items"]:
       - Fetch Listing (must be active + bookable)
       - Fetch ActivitySlot (must belong to listing, must be active)
       - Build schedule from slot
       - Price calculation (_calculate_item_price)
       - Availability check via _check_slot_capacity (no lock — informational only)
    - Sum item totals into BookingQuoteResult
    """
    items_data = payload.get("items", [])
    item_quotes = []

    for item_data in items_data:
        listing = _get_bookable_listing(item_data["listing_id"])
        slot = _get_active_slot(item_data["slot_id"], listing)
        schedule = _schedule_from_slot(slot, listing)

        _validate_traveller_count(listing, item_data["traveller_count"])

        pricing = _calculate_item_price(listing, item_data["traveller_count"], schedule)

        avail = "available"
        if not _check_slot_capacity(slot, item_data["traveller_count"]):
            avail = "conflict"

        item_quotes.append(ItemQuote(
            listing_id=listing.id,
            listing_title=listing.title,
            duration_type=schedule["duration_type"],
            start_date=schedule.get("start_date"),
            end_date=schedule.get("end_date"),
            days=schedule.get("days", 1),
            traveller_count=item_data["traveller_count"],
            price_per_person=pricing["price_per_person"],
            subtotal=pricing["subtotal"],
            discount_amount=pricing["discount_amount"],
            fee_amount=pricing["fee_amount"],
            tax_amount=pricing["tax_amount"],
            gross_amount=pricing["gross_amount"],
            quoted_total=pricing["gross_amount"],
            availability=avail,
        ))

    result = BookingQuoteResult(items=item_quotes)
    for q in item_quotes:
        result.subtotal += q.subtotal
        result.discount_amount += q.discount_amount
        result.fee_amount += q.fee_amount
        result.tax_amount += q.tax_amount
        result.gross_amount += q.gross_amount
        result.quoted_total += q.quoted_total

    return result


@transaction.atomic
def create_booking(user, payload: dict, idempotency_key: str = "") -> tuple:
    """
    Create a Booking container + BookingItems + AvailabilityHolds.

    Returns: (booking, created: bool)
        - created=True  → new booking, view should return HTTP 201
        - created=False → idempotency replay (same key), view should return HTTP 200

    Idempotency semantics (Option A — true replay):
        - Reusing an Idempotency-Key returns the original booking with HTTP 200.
        - This is the Stripe-style pattern: safe to retry, same body returned.

    Steps:
        - Idempotency check: if key set and booking exists → return (existing, False)
        - Determine source
        - Lock listings in sorted PK order (deadlock prevention)
        - For each item: validate, compute schedule, check conflicts, price
        - Create Booking (reference=None, set from PK after insert)
        - Create BookingItems + AvailabilityHolds
        - Write Booking-level status history
    """
    if idempotency_key:
        try:
            existing = Booking.objects.get(
                traveller=user, idempotency_key=idempotency_key
            )
            return existing, False   # replay — do not re-create
        except Booking.DoesNotExist:
            pass
        # Race case handled by try/except IntegrityError around create()

    items_data = payload.get("items", [])
    trip_plan_id = payload.get("trip_plan_id")
    source = BookingSource.TRIP_PLAN if trip_plan_id else BookingSource.DIRECT

    # validate trip_plan_id ownership before any DB writes
    if trip_plan_id:
        try:
            TripPlanner.objects.get(pk=trip_plan_id, traveller=user)
        except TripPlanner.DoesNotExist:
            raise ServiceError("Trip plan not found.", status_code=404)

    # Lock listings in sorted order (deadlock prevention)
    listing_ids = sorted(set(item["listing_id"] for item in items_data))
    listing_map = {
        l.id: l
        for l in Listing.objects.select_for_update().select_related("host__user").filter(id__in=listing_ids).order_by("id")
    }

    if len(listing_map) != len(listing_ids):
        missing = set(listing_ids) - set(listing_map.keys())
        raise ServiceError(f"Listings not found: {missing}", status_code=404)

    # Lock slots in sorted order (deadlock prevention + capacity race protection)
    slot_ids = sorted(set(item["slot_id"] for item in items_data))
    slot_map = {
        s.id: s
        for s in ActivitySlot.objects.select_for_update().filter(
            id__in=slot_ids, is_active=True
        ).order_by("id")
    }

    if len(slot_map) != len(slot_ids):
        missing = set(slot_ids) - set(slot_map.keys())
        raise ServiceError(f"Slots not found or inactive: {missing}", status_code=404)

    # Validate + price each item
    now = timezone.now()
    items_computed = []
    total_subtotal = Decimal("0")
    total_discount = Decimal("0")
    total_fee = Decimal("0")
    total_tax = Decimal("0")
    total_gross = Decimal("0")

    for item_data in items_data:
        listing = listing_map[item_data["listing_id"]]
        if not listing.host.user.is_active:
            raise ServiceError(
                f"Listing '{listing.title}' is not available for booking.",
                status_code=400,
            )
        if not (listing.is_active and listing.is_bookable):
            raise ServiceError(
                f"Listing '{listing.title}' is not available for booking.",
                status_code=400,
            )

        slot = slot_map[item_data["slot_id"]]
        if slot.listing_id != listing.id:
            raise ServiceError(
                f"Slot {slot.id} does not belong to listing {listing.id}.",
                status_code=400,
            )

        schedule = _schedule_from_slot(slot, listing)
        _validate_traveller_count(listing, item_data["traveller_count"])

        # Capacity check — also excludes stale expired bookings (Bug 1 fix)
        if not _check_slot_capacity(slot, item_data["traveller_count"]):
            raise ServiceError(
                f"Listing {listing.id} is not available for the requested dates.",
                code="availability_conflict",
                status_code=409,
            )

        pricing = _calculate_item_price(listing, item_data["traveller_count"], schedule)
        snapshot = _build_snapshot(listing)

        items_computed.append({
            "listing": listing,
            "slot": slot,
            "schedule": schedule,
            "pricing": pricing,
            "snapshot": snapshot,
            "traveller_count": item_data["traveller_count"],
            "trip_plan_item_id": item_data.get("trip_plan_item_id"),
        })

        total_subtotal += pricing["subtotal"]
        total_discount += pricing["discount_amount"]
        total_fee += pricing["fee_amount"]
        total_tax += pricing["tax_amount"]
        total_gross += pricing["gross_amount"]

    # -- Create Booking --------------------------------------------------------
    # reference is set to None here and computed from PK immediately after
    # insert — this guarantees uniqueness without any retry loop or random
    # collision risk.
    try:
        booking = Booking.objects.create(
            reference=None,
            traveller=user,
            trip_plan_id=trip_plan_id,
            source=source,
            status=BookingStatus.PENDING_PAYMENT,
            expires_at=now + timedelta(minutes=HOLD_MINUTES),
            idempotency_key=idempotency_key,
            subtotal=total_subtotal,
            discount_amount=total_discount,
            fee_amount=total_fee,
            tax_amount=total_tax,
            gross_amount=total_gross,
            quoted_total=total_gross,
        )
    except IntegrityError:
        # Race: another concurrent request already created with same idempotency key.
        if idempotency_key:
            return Booking.objects.get(traveller=user, idempotency_key=idempotency_key), False
        raise  # unexpected IntegrityError — re-raise

    # Stamp the human-readable reference using the guaranteed-unique PK.
    ref_date = min(
        (c["schedule"]["start_date"] for c in items_computed if c["schedule"].get("start_date")),
        default=timezone.localdate(),
    )
    booking.reference = f"BK-{ref_date.strftime('%Y%m%d')}-{booking.id:06d}"
    booking.save(update_fields=["reference"])

    # Create BookingItems + Holds
    for item_comp in items_computed:
        listing = item_comp["listing"]
        slot = item_comp["slot"]
        schedule = item_comp["schedule"]
        pricing = item_comp["pricing"]

        hold = AvailabilityHold.objects.create(
            listing=listing,
            traveller=user,
            duration_type=schedule["duration_type"],
            start_date=schedule.get("start_date"),
            end_date=schedule.get("end_date"),
            start_time=schedule.get("start_time"),
            end_time=schedule.get("end_time"),
            traveller_count=item_comp["traveller_count"],
            expires_at=booking.expires_at,
        )

        BookingItem.objects.create(
            booking=booking,
            listing=listing,
            slot=slot,
            trip_plan_item_id=item_comp["trip_plan_item_id"],
            duration_type=schedule["duration_type"],
            start_date=schedule.get("start_date"),
            end_date=schedule.get("end_date"),
            start_time=schedule.get("start_time"),
            end_time=schedule.get("end_time"),
            days=schedule.get("days", 1),
            nights=schedule.get("nights", 0),
            traveller_count=item_comp["traveller_count"],
            status=BookingItemStatus.PENDING_PAYMENT,
            snapshot=item_comp["snapshot"],
            price_per_person=pricing["price_per_person"],
            subtotal=pricing["subtotal"],
            discount_amount=pricing["discount_amount"],
            fee_amount=pricing["fee_amount"],
            tax_amount=pricing["tax_amount"],
            gross_amount=pricing["gross_amount"],
            quoted_total=pricing["gross_amount"],
            hold=hold,
        )

    # Booking-level status history
    BookingStatusHistory.objects.create(
        booking=booking,
        from_status="",
        to_status=BookingStatus.PENDING_PAYMENT,
        note="Booking created",
    )

    return booking, True  # True = new created


def create_booking_from_trip_plan(
    user,
    plan_id: int,
    items_data: list,
    idempotency_key: str = "",
) -> tuple:
    """
    Translate trip plan items into a create_booking() call.

    Each item_data must include:
        - trip_plan_item_id: the TripPlannerItem PK
        - slot_id:           the ActivitySlot to book
        - traveller_count:   number of travellers

    Steps:
        - Verify TripPlanner exists and belongs to traveller
        - Verify plan is in PLANNING state
        - For each item_data, look up TripPlannerItem to get listing_id;
          merge with caller-supplied slot_id + traveller_count
        - Delegate to create_booking() — all conflict/pricing/hold logic lives there

    Returns: (booking, created) — same contract as create_booking().
    """
    try:
        plan = TripPlanner.objects.get(pk=plan_id, traveller=user)
    except TripPlanner.DoesNotExist:
        raise ServiceError("Trip plan not found.", status_code=404)

    if plan.status != TripStatus.PLANNING:
        raise ServiceError(
            "Trip plan must be in 'planning' state to convert to booking.",
            code="invalid_plan_state",
            status_code=400,
        )

    translated_items = []
    for item_data in items_data:
        tpi_id = item_data["trip_plan_item_id"]
        try:
            tpi = TripPlannerItem.objects.select_related("listing").get(
                pk=tpi_id,
                trip_planner=plan,
                removed_at__isnull=True,
            )
        except TripPlannerItem.DoesNotExist:
            raise ServiceError(
                f"Trip plan item {tpi_id} not found in plan {plan_id}.",
                status_code=404,
            )

        translated_items.append({
            "listing_id": tpi.listing_id,
            "slot_id": item_data["slot_id"],
            "traveller_count": item_data["traveller_count"],
            "trip_plan_item_id": tpi_id,
        })

    payload = {
        "trip_plan_id": plan_id,
        "items": translated_items,
    }

    return create_booking(user, payload, idempotency_key)


# Private helpers

def _get_bookable_listing(listing_id: int) -> Listing:
    try:
        listing = Listing.objects.get(
            pk=listing_id,
            is_active=True,
            is_bookable=True,
            host__user__is_active=True,
        )
    except Listing.DoesNotExist:
        raise ServiceError(f"Listing {listing_id} not found or not bookable.", status_code=404)
    return listing


def _validate_traveller_count(listing: Listing, count: int) -> None:
    if count < listing.min_group_size:
        raise ServiceError(
            f"Minimum group size for '{listing.title}' is {listing.min_group_size}.",
            status_code=400,
        )
    if count > listing.max_group_size:
        raise ServiceError(
            f"Maximum group size for '{listing.title}' is {listing.max_group_size}.",
            status_code=400,
        )


def _get_active_slot(slot_id: int, listing: Listing) -> ActivitySlot:
    """
    Fetch an active ActivitySlot that belongs to the given listing.
    """
    try:
        return ActivitySlot.objects.get(pk=slot_id, listing=listing, is_active=True)
    except ActivitySlot.DoesNotExist:
        raise ServiceError(
            f"Slot {slot_id} not found or not available for listing {listing.id}.",
            status_code=404,
        )


def _schedule_from_slot(slot: ActivitySlot, listing: Listing) -> dict:
    """Build a schedule dict from an ActivitySlot. No user input needed."""
    days = (slot.end_date - slot.start_date).days or 1
    nights = max(days - 1, 0)
    return {
        "duration_type": listing.duration_type,
        "start_date": slot.start_date,
        "end_date": slot.end_date,
        "start_time": slot.start_time,
        "end_time": slot.end_time,
        "days": days,
        "nights": nights,
    }


def _build_snapshot(listing: Listing) -> dict:
    """
    Freeze listing data at booking time.
    """
    primary_img = listing.primary_image
    return {
        "title": listing.title,
        "destination": listing.destination,
        "location": listing.location,
        "price_per_person": str(listing.price_per_person),
        "duration_type": listing.duration_type,
        "duration_days": listing.duration_days,
        "duration_nights": listing.duration_nights,
        "cancellation_policy": listing.cancellation_policy,
        "host_name": listing.host_name,
        "primary_image_url": primary_img.image.url if primary_img else None,
    }
