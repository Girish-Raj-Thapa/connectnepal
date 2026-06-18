from datetime import timedelta
from decimal import Decimal

from django.db import transaction, IntegrityError
from django.db.models import Sum
from django.utils import timezone

from utils.exceptions import ServiceError
from ..models import (
    Booking, BookingItem,
    BookingStatusHistory,
    BookingStatus, BookingItemStatus, BookingSource,
)
from .pricing_service import HOLD_MINUTES, ACTIVE_ITEM_STATUSES, _check_slot_capacity, _calculate_package_price


@transaction.atomic
def create_package_booking(
    user,
    package_id: int,
    traveller_count: int,
    idempotency_key: str = "",
    package_slot_id: int | None = None,
) -> tuple:
    """
    Create a Booking for a Package with slot-based inventory.

    Mirrors the structure of create_booking() exactly, with the following
    differences:

    - The package row is locked with select_for_update to prevent concurrent
      requests from both passing the max_bookings cap check simultaneously.
    - No AvailabilityHold is created because packages have no time slot to
      reserve.  Overbooking risk is bounded by max_group_size and the optional
      max_bookings cap.
    - duration_type is stored as the plain string "package" — there is no
      corresponding DurationType enum value.
    - price_per_person is set to package.total_price, which is the host's
      all-inclusive per-person price for the full package duration.

    Returns:
        A (booking, created) tuple where created=True indicates a new
        booking (HTTP 201) and created=False indicates an idempotency replay
        (HTTP 200).

    Raises:
        ServiceError(package_not_bookable):       Package is inactive or unpublished.
        ServiceError(package_empty):              Package has no listings configured.
        ServiceError(group_size_exceeded):        traveller_count > max_group_size.
        ServiceError(package_fully_booked):       Active bookings have reached max_bookings (if set).
        ServiceError(package_not_yet_valid):      Today is before valid_from.
        ServiceError(package_expired):            Today is after valid_until.
        ServiceError(package_slot_not_found):     Explicit slot not found / wrong package.
        ServiceError(package_slot_out_of_window): Slot's departure date is in the past.
        ServiceError(package_slot_full):          Slot has no remaining capacity.
        ServiceError(package_no_available_slots): No upcoming slots exist (auto-assign path).
    """
    # - Idempotency check
    if idempotency_key:
        try:
            existing = Booking.objects.get(traveller=user, idempotency_key=idempotency_key)
            return existing, False
        except Booking.DoesNotExist:
            pass

    # - Lock package row
    # Lazy import avoids a circular dependency (packages → bookings → packages).
    from packages.models import Package
    try:
        package = Package.objects.select_for_update().select_related("host__user").get(pk=package_id)
    except Package.DoesNotExist:
        raise ServiceError(f"Package {package_id} not found.", status_code=404)

    # ─ Business validation
    if not package.is_active or not package.is_bookable:
        raise ServiceError(
            "This package is not available for booking.",
            code="package_not_bookable",
            status_code=400,
        )

    if package.package_listings.count() < 1:
        raise ServiceError(
            "This package has no listings configured.",
            code="package_empty",
            status_code=400,
        )

    if traveller_count < 1:
        raise ServiceError("traveller_count must be at least 1.", status_code=400)

    if traveller_count > package.max_group_size:
        raise ServiceError(
            f"This package allows a maximum of {package.max_group_size} travellers.",
            code="group_size_exceeded",
            status_code=400,
        )

    now = timezone.now()
    today = timezone.localdate()

    # Optional max_bookings cap — race-safe because the package row is locked above.
    if package.max_bookings is not None:
        active_total = (
            BookingItem.objects
            .filter(package=package, status__in=ACTIVE_ITEM_STATUSES)
            .exclude(booking__expires_at__lt=now)
            .exclude(booking__status=BookingStatus.EXPIRED)
            .aggregate(total=Sum("traveller_count"))["total"] or 0
        )
        if active_total + traveller_count > package.max_bookings:
            raise ServiceError(
                "This package is fully booked.",
                code="package_fully_booked",
                status_code=409,
            )

    if package.valid_from and today < package.valid_from:
        raise ServiceError(
            f"This package is not available until {package.valid_from}.",
            code="package_not_yet_valid",
            status_code=400,
        )
    if package.valid_until and today > package.valid_until:
        raise ServiceError(
            f"This package expired on {package.valid_until}.",
            code="package_expired",
            status_code=400,
        )

    # - Slot assignment
    from packages.models import PackageSlot

    if package_slot_id is not None:
        # Explicit slot: verify it belongs to this package and is still open.
        try:
            pkg_slot = PackageSlot.objects.select_for_update().get(
                pk=package_slot_id,
                package=package,
                is_active=True,
            )
        except PackageSlot.DoesNotExist:
            raise ServiceError(
                "Package slot not found or inactive.",
                code="package_slot_not_found",
                status_code=404,
            )
        if pkg_slot.start_date < today:
            raise ServiceError(
                "Cannot book a slot whose departure date has already passed.",
                code="package_slot_out_of_window",
                status_code=400,
            )
        if not _check_slot_capacity(pkg_slot, traveller_count, slot_field="package_slot"):
            raise ServiceError(
                "This package slot is fully booked.",
                code="package_slot_full",
                status_code=409,
            )
    else:
        # Auto-assign: pick the earliest upcoming slot that has capacity.
        # Find candidate without lock first, then re-fetch with lock to close
        # the race window (two concurrent requests; only one lock wins).
        candidate = (
            PackageSlot.objects
            .filter(package=package, is_active=True, start_date__gte=today)
            .order_by("start_date")
            .first()
        )
        if candidate is None:
            raise ServiceError(
                "No upcoming slots are available for this package.",
                code="package_no_available_slots",
                status_code=409,
            )
        pkg_slot = PackageSlot.objects.select_for_update().get(pk=candidate.pk)
        if not _check_slot_capacity(pkg_slot, traveller_count, slot_field="package_slot"):
            raise ServiceError(
                "This package slot is fully booked.",
                code="package_slot_full",
                status_code=409,
            )

    # ─ Price calculation
    price_data = _calculate_package_price(package, traveller_count)

    # ─ Create Booking + BookingItem
    try:
        booking = Booking.objects.create(
            reference=None,
            traveller=user,
            source=BookingSource.DIRECT,
            status=BookingStatus.PENDING_PAYMENT,
            expires_at=now + timedelta(minutes=HOLD_MINUTES),
            idempotency_key=idempotency_key,
            subtotal=price_data["subtotal"],
            discount_amount=price_data["discount_amount"],
            fee_amount=price_data["fee_amount"],
            tax_amount=price_data["tax_amount"],
            gross_amount=price_data["gross_amount"],
            quoted_total=price_data["gross_amount"],
        )
    except IntegrityError:
        # Concurrent request already created a booking with the same idempotency key.
        if idempotency_key:
            return Booking.objects.get(traveller=user, idempotency_key=idempotency_key), False
        raise

    booking.reference = f"BK-{today:%Y%m%d}-{booking.id:06d}"
    booking.save(update_fields=["reference"])

    snapshot = _build_package_snapshot(package, slot=pkg_slot)

    BookingItem.objects.create(
        booking=booking,
        package=package,
        package_slot=pkg_slot,
        listing=None,
        duration_type="package",
        start_date=pkg_slot.start_date,
        end_date=pkg_slot.end_date,
        days=package.duration_days,
        nights=package.duration_nights,
        traveller_count=traveller_count,
        status=BookingItemStatus.PENDING_PAYMENT,
        snapshot=snapshot,
        price_per_person=package.total_price,
        subtotal=price_data["subtotal"],
        discount_amount=price_data["discount_amount"],
        fee_amount=price_data["fee_amount"],
        tax_amount=price_data["tax_amount"],
        gross_amount=price_data["gross_amount"],
        quoted_total=price_data["gross_amount"],
    )

    # ─ Booking-level status history
    BookingStatusHistory.objects.create(
        booking=booking,
        from_status="",
        to_status=BookingStatus.PENDING_PAYMENT,
        note="Package booking created",
    )

    return booking, True


# ─ Private helpers

def _build_package_snapshot(package, slot=None) -> dict:
    """
    Freeze package data at booking time.

    Serves the same role as _build_snapshot() for listing-based bookings.
    The host may later edit or delete the package; this snapshot preserves the
    exact state the traveller agreed to at the moment of booking.
    """
    snap = {
        "package_id": package.id,
        "package_title": package.title,
        "total_price": str(package.total_price),
        "duration_days": package.duration_days,
        "duration_nights": package.duration_nights,
        "host_name": package.host.business_name or package.host.user.get_full_name(),
        "cover_image_url": package.cover_image.url if package.cover_image else None,
    }
    if slot is not None:
        snap["slot_id"] = slot.id
        snap["start_date"] = slot.start_date.isoformat()
        snap["end_date"] = slot.end_date.isoformat()
    return snap
