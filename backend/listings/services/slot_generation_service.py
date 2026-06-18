"""
Slot generation service.

Idempotently fills ActivitySlot records for every active ListingSchedule.
Safe to call repeatedly — uses get_or_create, never overwrites existing slots.

Entry points:
    generate_slots_for_listing(listing, days_ahead=None) -> int
    generate_slots_for_all_listings(days_ahead=None)     -> int
"""
import logging
from datetime import date, timedelta, time as time_type

from django.db import transaction

from listings.models import (
    Listing, ActivitySlot, ListingSchedule, SlotException, DurationType,
)

logger = logging.getLogger("listings.slot_generation")


def generate_slots_for_listing(listing: Listing, days_ahead: int | None = None) -> int:
    """
    Generate ActivitySlots for a single listing based on its active schedules.

    Returns the number of new slots created (existing slots are untouched).
    """
    schedules = listing.schedules.filter(is_active=True)
    if not schedules.exists():
        return 0

    today = date.today()
    # Use the max advance_days across all schedules as the query horizon for exceptions
    max_horizon = max(
        (s.advance_days for s in schedules),
        default=days_ahead or 90,
    )
    horizon_end = today + timedelta(days=max_horizon)

    # Load all exceptions for this listing in the window — one query, index-hit
    exceptions: dict[date, SlotException] = {
        e.date: e
        for e in listing.slot_exceptions.filter(
            date__gte=today,
            date__lte=horizon_end,
        )
    }

    created_total = 0

    for schedule in schedules:
        effective_horizon = days_ahead if days_ahead is not None else schedule.advance_days
        start = max(schedule.valid_from or today, today)
        end = min(
            schedule.valid_until or (today + timedelta(days=effective_horizon)),
            today + timedelta(days=effective_horizon),
        )

        if start > end:
            continue

        created_total += _generate_for_schedule(listing, schedule, start, end, exceptions)

    return created_total


def generate_slots_for_all_listings(days_ahead: int | None = None) -> int:
    """
    Generate slots for every active, bookable listing that has at least one
    active schedule. Runs inside a single transaction per listing.
    """
    listings = (
        Listing.objects
        .filter(is_active=True, is_bookable=True)
        .prefetch_related("schedules")
    )

    total = 0
    for listing in listings:
        try:
            with transaction.atomic():
                created = generate_slots_for_listing(listing, days_ahead)
                total += created
                if created:
                    logger.info(
                        "generate_slots: listing %s (%s) → %d new slots",
                        listing.pk, listing.title, created,
                    )
        except Exception:
            logger.exception(
                "generate_slots: failed for listing %s (%s), skipping",
                listing.pk, listing.title,
            )

    return total


# ── Internal helpers ──────────────────────────────────────────────────────────

def _generate_for_schedule(
    listing: Listing,
    schedule: ListingSchedule,
    start: date,
    end: date,
    exceptions: dict,
) -> int:
    """Walk the date range and create slots for qualifying days."""
    created = 0
    current = start

    while current <= end:
        # Skip days not in the schedule's pattern
        if current.weekday() not in schedule.days_of_week:
            current += timedelta(days=1)
            continue

        # Check for an exception on this date
        exc = exceptions.get(current)
        if exc and exc.is_closed:
            current += timedelta(days=1)
            continue

        capacity = (
            exc.capacity_override
            if exc and exc.capacity_override is not None
            else schedule.capacity
        )
        # Hard ceiling: a slot can never exceed the listing's max_group_size
        capacity = min(capacity, listing.max_group_size)

        # Derive end_date from duration type
        if listing.duration_type == DurationType.MULTI_DAY:
            end_date = current + timedelta(days=max(listing.duration_days - 1, 0))
        else:
            end_date = current

        if listing.duration_type == DurationType.HOURLY and schedule.time_slots:
            created += _create_hourly_slots(listing, current, end_date, schedule.time_slots, capacity)
        else:
            _, was_created = ActivitySlot.objects.get_or_create(
                listing=listing,
                start_date=current,
                end_date=end_date,
                start_time=None,
                defaults={"end_time": None, "capacity": capacity},
            )
            if was_created:
                created += 1

        current += timedelta(days=1)

    return created


def _create_hourly_slots(
    listing: Listing,
    start_date: date,
    end_date: date,
    time_slots: list,
    capacity: int,
) -> int:
    """Create one ActivitySlot per time window for an HOURLY listing."""
    created = 0
    for window in time_slots:
        try:
            start_t = _parse_time(window["start"])
            end_t = _parse_time(window["end"])
        except (KeyError, ValueError):
            logger.warning("Skipping malformed time_slot window: %s", window)
            continue

        _, was_created = ActivitySlot.objects.get_or_create(
            listing=listing,
            start_date=start_date,
            end_date=end_date,
            start_time=start_t,
            defaults={"end_time": end_t, "capacity": capacity},
        )
        if was_created:
            created += 1

    return created


def _parse_time(value: str) -> time_type:
    """Parse 'HH:MM' or 'HH:MM:SS' into a time object."""
    parts = value.strip().split(":")
    if len(parts) < 2:
        raise ValueError(f"Cannot parse time: {value!r}")
    return time_type(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
