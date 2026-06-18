import logging
from datetime import date, timedelta

from django.db import IntegrityError, transaction

from utils.exceptions import ServiceError
from ..models import Package, PackageSchedule, PackageSlot, PackageSlotException

logger = logging.getLogger("packages.schedule")


# SCHEDULE CRUD

@transaction.atomic
def create_schedule(package: Package, data: dict) -> PackageSchedule:
    """
    Create a new PackageSchedule for a package.

    Args:
        package: The Package this schedule belongs to.
        data:    Validated dict with days_of_week, capacity, advance_days,
                 valid_from, valid_until, is_active.

    Returns:
        The newly created PackageSchedule.

    Raises:
        ServiceError(invalid_schedule_dates): valid_until < valid_from when both set.
        ServiceError(invalid_days_of_week):   days_of_week contains values outside 0-6.
    """
    _validate_schedule_data(data)

    return PackageSchedule.objects.create(package=package, **data)


@transaction.atomic
def update_schedule(schedule: PackageSchedule, data: dict) -> PackageSchedule:
    """
    Partially update a PackageSchedule (PATCH semantics).

    Args:
        schedule: The PackageSchedule to update.
        data:     Dict of fields to change (all optional).

    Returns:
        The updated PackageSchedule.
    """
    if data:
        _validate_schedule_data(data)
    
    for field, value in data.items():
        setattr(schedule, field, value)
    
    schedule.save(update_fields=list(data.keys()) + ["updated_at"])

    return schedule


@transaction.atomic
def delete_schedule(schedule: PackageSchedule) -> None:
    """
    Delete a PackageSchedule.

    Does NOT delete existing generated PackageSlots — those remain valid.
    The schedule controls future generation only.
    """
    schedule.delete()


# EXCEPTION CRUD

@transaction.atomic
def create_exception(package: Package, data: dict) -> PackageSlotException:
    """
    Create a PackageSlotException (date override / closure).

    Args:
        package: The Package this exception applies to.
        data:    Validated dict with date, is_closed, capacity_override, note.

    Returns:
        The newly created PackageSlotException.

    Raises:
        ServiceError(exception_already_exists): An exception for this date already exists.
    """
    exc_date = data["date"]

    if PackageSlotException.objects.filter(package=package, date=exc_date).exists():
        raise ServiceError(
            f"An exception already exists for {exc_date} on this package.",
            code="exception_already_exists",
            status_code=409,
        )

    try:
        return PackageSlotException.objects.create(package=package, **data)
    except IntegrityError as exc:
        raise ServiceError(
            f"An exception already exists for {exc_date} on this package.",
            code="exception_already_exists",
            status_code=409,
        ) from exc


@transaction.atomic
def update_exception(exception: PackageSlotException, data: dict) -> PackageSlotException:
    """
    Partially update a PackageSlotException.
    """
    for field, value in data.items():
        setattr(exception, field, value)

    exception.save(update_fields=list(data.keys()))
    
    return exception


@transaction.atomic
def delete_exception(exception: PackageSlotException) -> None:
    """
    Delete a PackageSlotException.
    """

    exception.delete()


# SLOT GENERATION
def generate_slots_for_package(package: Package, days_ahead: int | None = None) -> int:
    """
    Generate PackageSlots for a single package based on its active schedules.

    Uses get_or_create — safe to call repeatedly (idempotent).
    Respects PackageSlotException: closed dates are skipped, capacity_override
    values are used when set.

    Args:
        package:    The Package to generate slots for.
        days_ahead: Override advance_days for all schedules (optional).

    Returns:
        Number of new PackageSlots created.
    """
    schedules = package.schedules.filter(is_active=True)
    if not schedules.exists():
        return 0
    
    today = date.today()
    max_horizon = max(
        (s.advance_days for s in schedules),
        default=days_ahead or 90,
    )
    horizon_end = today + timedelta(days=max_horizon)

    # Load all exceptions for this package in the window — one query
    exceptions: dict = {
        e.date: e
        for e in package.exceptions.filter(
            date__gte=today,
            date__lte=horizon_end,
        )
    }

    created_total = 0
    duration_days = max(package.duration_days, 1)

    for schedule in schedules:
        effective_horizon = days_ahead if days_ahead is not None else schedule.advance_days
        start = max(schedule.valid_from or today, today)
        end = min(
            schedule.valid_until or (today + timedelta(days=effective_horizon)),
            today + timedelta(days=effective_horizon),
        )
        logger.info(f"generate_slots: schedule {schedule.id}: effective_horizon={effective_horizon}, valid_from={schedule.valid_from}, valid_until={schedule.valid_until}, computed start={start}, computed end={end}")

        if start > end:
            continue

        created_total += _generate_for_schedule(
            package, schedule, start, end, exceptions, duration_days
        )
    
    return created_total 


def generate_slots_for_all_packages(days_ahead: int | None = None) -> int:
    """
    Generate slots for every active, bookable package that has at least one
    active schedule. Runs inside a separate transaction per package so that a
    failure for one package does not roll back others.

    Entry point for the nightly management command.

    Returns:
        Total number of new PackageSlots created across all packages.
    """

    packages = (
        Package.objects
        .filter(is_active=True, is_bookable=True)
        .prefetch_related("schedules")
    )
    
    total = 0
    for package in packages:
        try:
            with transaction.atomic():
                created = generate_slots_for_package(package, days_ahead)
                total += created
                if created: 
                    logger.info(
                        "generate_package_slots: package %s (%s) → %d new slots",
                        package.pk, package.title, created,
                    )
        except Exception:
            logger.exception(
                "generate_package_slots: failed for package %s (%s), skipping",
                package.pk, package.title,
            )
    
    return total 



# INTERNAL HELPER FUNCTIONS

def _generate_for_schedule(
    package: Package,
    schedule: PackageSchedule,
    start: date,
    end: date,
    exceptions: dict,
    duration_days: int,
) -> int:
    """
    Walk the date range and create slots for qualifying departure days.
    """
    created = 0
    current = start
    logger.info(f"_generate_for_schedule: package={package.id}, schedule={schedule.id}, start={start}, end={end}, days_of_week={schedule.days_of_week}")

    while current <= end:
        # Skip days not in the schedule's day pattern
        if current.weekday() not in schedule.days_of_week:
            current += timedelta(days=1)
            continue

        # check for exception on this date
        exc = exceptions.get(current)
        if exc and exc.is_closed:
            current += timedelta(days=1)
            continue

        capacity = (
            exc.capacity_override
            if exc and exc.capacity_override is not None
            else schedule.capacity
        )

        end_date = current + timedelta(days=duration_days - 1)

        _, was_created = PackageSlot.objects.get_or_create(
            package=package,
            start_date=current,
            defaults={
                "end_date": end_date,
                "capacity": capacity,
                "is_active": True,
            },
        )

        if was_created:
            created += 1
        
        current += timedelta(days=1)

    return created 


def _validate_schedule_data(data: dict) -> None:
    """
    Validate schedule field combinations.
    """
    valid_from = data.get("valid_from")
    valid_until = data.get("valid_until")
    if valid_from and valid_until and valid_until < valid_from:
        raise ServiceError(
            "valid_until must be on or after valid_from.",
            code="invalid_schedule_dates",
            status_code=400,
        )
    
    days = data.get("days_of_week")

    if days is not None:
        if not isinstance(days, list) or not days:
            raise ServiceError(
                "days_of_week must be a non-empty list.",
                code="invalid_days_of_week",
                status_code=400,
            )
        
        if any(d not in range(7) for d in days):
            raise ServiceError(
                "days_of_week values must be integers 0–6 (0=Mon, 6=Sun).",
                code="invalid_days_of_week",
                status_code=400,
            )
