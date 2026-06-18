"""
Data migration: seed a default PackageSchedule + initial PackageSlots for every
active Package that does not yet have any schedule.

Run once after 0002_packageslotexception_packageslot_packageschedule.

Safe to run multiple times — the schedule check (`if not schedules.exists()`) and
the slot `get_or_create` both make it fully idempotent.
"""
from datetime import date, timedelta

from django.db import migrations


DEFAULT_ADVANCE_DAYS = 90
DEFAULT_CAPACITY = 20
ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]


def _generate_slots(PackageSlot, package, schedule):
    """
    Inline slot generation — mirrors package_schedule_service._generate_for_schedule().
    Written inline so the migration remains self-contained and is not broken if the
    service layer is refactored after this migration is committed.
    """
    today = date.today()
    duration_days = max(package.duration_days, 1)

    start = max(schedule.valid_from or today, today)
    end = min(
        schedule.valid_until or (today + timedelta(days=schedule.advance_days)),
        today + timedelta(days=schedule.advance_days),
    )

    if start > end:
        return 0

    created = 0
    current = start
    while current <= end:
        if current.weekday() in schedule.days_of_week:
            end_date = current + timedelta(days=duration_days - 1)
            _, was_created = PackageSlot.objects.get_or_create(
                package=package,
                start_date=current,
                defaults={
                    "end_date": end_date,
                    "capacity": schedule.capacity,
                    "is_active": True,
                },
            )
            if was_created:
                created += 1
        current += timedelta(days=1)

    return created


def seed_schedules_and_slots(apps, schema_editor):
    Package = apps.get_model("packages", "Package")
    PackageSchedule = apps.get_model("packages", "PackageSchedule")
    PackageSlot = apps.get_model("packages", "PackageSlot")

    for package in Package.objects.filter(is_active=True):
        # Only seed packages that have no schedule yet
        if PackageSchedule.objects.filter(package=package).exists():
            continue

        capacity = package.max_bookings if package.max_bookings else DEFAULT_CAPACITY

        schedule = PackageSchedule.objects.create(
            package=package,
            days_of_week=ALL_DAYS,
            capacity=capacity,
            advance_days=DEFAULT_ADVANCE_DAYS,
            valid_from=package.valid_from,
            valid_until=package.valid_until,
            is_active=True,
        )

        _generate_slots(PackageSlot, package, schedule)


class Migration(migrations.Migration):

    dependencies = [
        ("packages", "0002_packageslotexception_packageslot_packageschedule"),
    ]

    operations = [
        migrations.RunPython(seed_schedules_and_slots, migrations.RunPython.noop),
    ]
