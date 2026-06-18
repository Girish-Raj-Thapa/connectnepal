from datetime import date

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from utils.exceptions import ServiceError
from ..models import Package, PackageSlot


# PUBLIC FUNCTIONS

@transaction.atomic 
def create_slot(package: Package, data: dict) -> PackageSlot:
    """
    Create a new PackageSlot for a package.

    Validates:
    - start_date <= end_date
    - No existing slot for this package on start_date (unique constraint)

    Args:
        package: The Package this slot belongs to.
        data:    Validated dict with start_date, end_date, capacity, is_active.

    Returns:
        The newly created PackageSlot.

    Raises:
        ServiceError(invalid_dates):     start_date > end_date.
        ServiceError(slot_already_exists): A slot for this start_date already exists.
    """
    start_date = data["start_date"]
    end_date = data["end_date"]

    if start_date > end_date:
        raise ServiceError(
            "start_date must be on or before end_date",
            code="invalid_dates",
            status_code=400,
        )
    
    if PackageSlot.objects.filter(package=package, start_date=start_date).exists():
        raise ServiceError(
            f"A slot already exists for {start_date} on this package.",
            code="slot_already_exists",
            status_code=409,
        )

    try:
        return PackageSlot.objects.create(package=package, **data)
    except IntegrityError as exc:
        raise ServiceError(
            f"A slot already exists for {start_date} on this package.",
            code="slot_already_exists",
            status_code=409,
        ) from exc


@transaction.atomic
def update_slot(slot: PackageSlot, data: dict) -> PackageSlot:
    """
    Partially update a PackageSlot (PATCH semantics).

    Guards against reducing capacity below the currently booked count so that
    confirmed travellers are never orphaned.

    Args:
        slot: The PackageSlot to update.
        data: Dict of fields to change (all optional).

    Returns:
        The updated PackageSlot.

    Raises:
        ServiceError(capacity_too_low): New capacity < currently booked travellers.
    """
    if "capacity" in data:
        from bookings.models import BookingItem, BookingItemStatus, BookingStatus

        now = timezone.now()
        booked = (
            BookingItem.objects
            .filter(
                package_slot=slot,
                status__in=[
                    BookingItemStatus.PENDING_PAYMENT,
                    BookingItemStatus.CONFIRMED,
                ],
            )
            .exclude(booking__expires_at__lt=now)
            .exclude(booking__status=BookingStatus.EXPIRED)
            .aggregate(total=Sum("traveller_count"))["total"] or 0
        )
        if data["capacity"] < booked:
            raise ServiceError(
                f"Cannot reduce capacity below {booked} (currently booked travellers).",
                code="capacity_too_low",
                status_code=400,
            )
    
    for field, value in data.items():
        setattr(slot, field, value)
    
    slot.save(update_fields=list(data.keys()) + ["updated_at"])

    return slot 


@transaction.atomic
def delete_slot(slot: PackageSlot) -> None:
    """
    Delete a PackageSlot.

    Blocked if any active (pending_payment or confirmed) BookingItems exist on
    this slot, because deleting it would orphan live bookings.

    Args:
        slot: The PackageSlot to delete.

    Raises:
        ServiceError(active_bookings_exist): Slot has live bookings.
    """
    from bookings.models import BookingItem, BookingItemStatus, BookingStatus

    active = BookingItem.objects.filter(
        package_slot=slot,
        booking__status__in=[BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED],
    ).count()

    if active > 0:
        raise ServiceError(
            "Cannot delete a slot that has active or confirmed bookings.",
            code="active_bookings_exist",
            status_code=400,
        )
    
    slot.delete()


def get_upcoming_slots(package: Package, date_from=None):
    """
    Return upcoming active PackageSlots for a package.

    Args:
        package:   The Package to query.
        date_from: Optional start date filter; defaults to today.

    Returns:
        QuerySet of PackageSlot ordered by start_date.
    """
    from_date = date_from or date.today()

    return (
        PackageSlot.objects
        .filter(package=package, is_active=True, start_date__gte=from_date)
        .order_by("start_date")
    )
