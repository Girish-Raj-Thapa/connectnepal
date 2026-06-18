from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from utils.files import delete_file_field
from .models import Package, PackageSchedule, PackageSlotException


def _queue_generate_slots(package_id: int) -> None:
    from packages.tasks import generate_slots_for_package_task

    transaction.on_commit(
        lambda: generate_slots_for_package_task.delay(package_id)
    )


def _queue_regenerate_slots(package_id: int) -> None:
    from packages.tasks import regenerate_slots_for_package_task

    transaction.on_commit(
        lambda: regenerate_slots_for_package_task.delay(package_id)
    )


@receiver(post_delete, sender=Package)
def delete_package_cover_image_on_delete(sender, instance, **kwargs):
    """
    Remove cover image from storage when a Package record is deleted.
    """
    delete_file_field(instance.cover_image)


@receiver(pre_save, sender=Package)
def delete_old_package_cover_image_on_replace(sender, instance, **kwargs):
    """
    Remove the old cover image from storage when a host uploads a new one.
    """
    if not instance.pk:
        return
    try:
        old = Package.objects.get(pk=instance.pk)
    except Package.DoesNotExist:
        return
    if old.cover_image and old.cover_image != instance.cover_image:
        delete_file_field(old.cover_image)


@receiver(pre_save, sender=Package)
def _capture_package_bookable_state(sender, instance, **kwargs):
    """
    Snapshot the old is_bookable value so post_save can detect False -> True.
    """
    if not instance.pk:
        instance._was_bookable = False
        return

    try:
        instance._was_bookable = Package.objects.values_list(
            "is_bookable", flat=True
        ).get(pk=instance.pk)
    except Package.DoesNotExist:
        instance._was_bookable = False


@receiver(post_save, sender=Package)
def generate_slots_on_publish(sender, instance, **kwargs):
    """
    Queue initial slot generation when a package is published.
    """
    was_bookable = getattr(instance, "_was_bookable", False)
    if instance.is_bookable and instance.is_active and not was_bookable:
        _queue_generate_slots(instance.pk)


@receiver(post_save, sender=PackageSchedule)
def regenerate_slots_on_schedule_save(sender, instance, **kwargs):
    """
    Queue slot regeneration whenever a schedule is created or updated.
    """
    _queue_regenerate_slots(instance.package_id)


@receiver(post_delete, sender=PackageSchedule)
def regenerate_slots_on_schedule_delete(sender, instance, **kwargs):
    """
    Queue slot regeneration when a schedule is deleted.
    """
    _queue_regenerate_slots(instance.package_id)


@receiver(post_save, sender=PackageSlotException)
def regenerate_slots_on_exception_save(sender, instance, **kwargs):
    """
    Queue slot regeneration whenever a package slot exception is created or updated.
    """
    _queue_regenerate_slots(instance.package_id)


@receiver(post_delete, sender=PackageSlotException)
def regenerate_slots_on_exception_delete(sender, instance, **kwargs):
    """
    Queue slot regeneration when a package slot exception is deleted.
    """
    _queue_regenerate_slots(instance.package_id)
    