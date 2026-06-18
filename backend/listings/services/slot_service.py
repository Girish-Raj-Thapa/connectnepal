from django.db import IntegrityError

from listings.models import ActivitySlot, ListingSchedule, SlotException
from utils.exceptions import ServiceError


# SLOT OPERATIONS

def create_slot(listing, data: dict) -> ActivitySlot:
    """
    Create a new ActivitySlot for a listing.

    Raises:
        ServiceError (409): if a slot with this schedule already exists.
    """
    try:
        return ActivitySlot.objects.create(
            listing=listing,
            start_date=data["start_date"],
            end_date=data.get("end_date", data["start_date"]),
            start_time=data.get("start_time"),
            end_time=data.get("end_time"),
            capacity=data["capacity"],
        )
    except IntegrityError:
        raise ServiceError(
            detail="A slot with this schedule already exists for this listing.",
            status_code=409,
        )


def update_slot(slot: ActivitySlot, data: dict) -> ActivitySlot:
    """Update capacity and/or is_active on an existing slot."""
    if "capacity" in data:
        slot.capacity = data["capacity"]
    if "is_active" in data:
        slot.is_active = data["is_active"]
    slot.save()
    return slot


def delete_or_deactivate_slot(slot: ActivitySlot) -> dict:
    """
    Delete the slot if it has no active bookings.
    If active bookings exist, deactivate instead to preserve booking integrity.

    Returns:
        {'deleted': True} if hard-deleted.
        {'deleted': False, 'slot': slot} if deactivated.
    """
    from bookings.models import BookingItem, BookingItemStatus

    has_active = BookingItem.objects.filter(
        slot=slot,
        status__in=[BookingItemStatus.PENDING_PAYMENT, BookingItemStatus.CONFIRMED],
    ).exists()

    if has_active:
        slot.is_active = False
        slot.save(update_fields=["is_active"])
        return {"deleted": False, "slot": slot}

    slot.delete()
    return {"deleted": True}


# SCHEDULE OPERATIONS

def create_schedule(listing, data: dict) -> ListingSchedule:
    """Create a new ListingSchedule for a listing."""
    return ListingSchedule.objects.create(
        listing=listing,
        days_of_week=data["days_of_week"],
        time_slots=data.get("time_slots", []),
        capacity=data["capacity"],
        advance_days=data.get("advance_days", 90),
        valid_from=data.get("valid_from"),
        valid_until=data.get("valid_until"),
        is_active=data.get("is_active", True),
    )


def update_schedule(schedule: ListingSchedule, data: dict) -> ListingSchedule:
    """Apply partial update to a schedule."""
    for field, value in data.items():
        setattr(schedule, field, value)
    schedule.save()
    return schedule


# SLOT EXCEPTION OPERATIONS

def create_slot_exception(listing, data: dict) -> SlotException:
    """
    Create a one-off SlotException (date override) for a listing.

    Raises:
        ServiceError (409): if an exception for this date already exists.
    """
    try:
        return SlotException.objects.create(listing=listing, **data)
    except IntegrityError:
        raise ServiceError(
            detail="An exception for this date already exists. Use PATCH to update it.",
            status_code=409,
        )
