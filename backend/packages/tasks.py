from datetime import date 

from celery import shared_task
from django.db import transaction

from packages.services.package_schedule_service import (
    generate_slots_for_all_packages,
    generate_slots_for_package,
)


@shared_task(
    name="packages.tasks.generate_slots_task",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def generate_slots_task(self):
    """
    Nightly bulk package slot generation.

    Safe to run multiple times because package slot generation already uses get_or_create semantics in the service layer.
    """
    try:
        count = generate_slots_for_all_packages()
        return {"slots_created": count}
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(
    name="packages.tasks.generate_slots_for_package_task",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def generate_slots_for_package_task(self, package_id):
    """
    Generate slots for one package.

    Used for:
        - publish-triggered generation
        - manual host-triggered generation
    """
    from packages.models import Package

    try:
        package = Package.objects.get(pk=package_id)
        count = generate_slots_for_package(package)
        return {"package_id": package_id, "slots_created": count}
    except Package.DoesNotExist:
        return {"package_id": package_id, "error": "not found"}
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(
    name="packages.tasks.regenerate_slots_for_package_task",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def regenerate_slots_for_package_task(self, package_id):
    """
    Delete future unbooked slots and regenerate them from the current package schedule and exception state.

    Safety rule:
        - never delete a future slot that already has a CONFIRMED or PENDING_PAYMENT booking item attached
    """
    from bookings.models import BookingItemStatus
    from packages.models import Package, PackageSlot

    try:
        package = Package.objects.get(pk=package_id)
    except Package.DoesNotExist:
        return {"package_id": package_id, "error": "not found"}

    try:
        with transaction.atomic():
            today = date.today()

            booked_slot_ids = set(
                PackageSlot.objects.filter(
                    package_id=package_id,
                    start_date__gte=today,
                    booking_items__status__in=[
                        BookingItemStatus.CONFIRMED,
                        BookingItemStatus.PENDING_PAYMENT,
                    ],
                ).values_list("id", flat=True)
            )

            deleted, _ = (
                PackageSlot.objects.filter(
                    package_id=package_id,
                    start_date__gte=today,
                )
                .exclude(id__in=booked_slot_ids)
                .delete()
            )

            created = generate_slots_for_package(package)

        return {
            "package_id": package_id,
            "slots_deleted": deleted,
            "slots_created": created,
        }
    except Exception as exc:
        raise self.retry(exc=exc)
    
