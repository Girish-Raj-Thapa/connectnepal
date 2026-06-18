from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver

from utils.files import delete_file_field
from .models import Account, HostDocument


# Account.profile_photo

@receiver(post_delete, sender=Account)
def delete_account_profile_photo_on_delete(sender, instance, **kwargs):
    """Remove profile photo from storage when an Account record is deleted."""
    delete_file_field(instance.profile_photo)


@receiver(pre_save, sender=Account)
def delete_old_profile_photo_on_replace(sender, instance, **kwargs):
    """
    Remove the old profile photo from storage when a user uploads a new one.

    Skips new records (no pk yet) and skips if the photo has not changed.
    """
    if not instance.pk:
        return
    try:
        old = Account.objects.get(pk=instance.pk)
    except Account.DoesNotExist:
        return
    if old.profile_photo and old.profile_photo != instance.profile_photo:
        delete_file_field(old.profile_photo)


# HostDocument.file_path

@receiver(post_delete, sender=HostDocument)
def delete_host_document_file_on_delete(sender, instance, **kwargs):
    """Remove host document from storage when a HostDocument record is deleted."""
    delete_file_field(instance.file_path)


@receiver(pre_save, sender=HostDocument)
def delete_old_host_document_on_replace(sender, instance, **kwargs):
    """
    Remove the old host document from storage when it is replaced with a new file.

    This covers the case where a host re-uploads a document of the same type
    (unique_together = host + document_type), which updates the existing row.
    """
    if not instance.pk:
        return
    try:
        old = HostDocument.objects.get(pk=instance.pk)
    except HostDocument.DoesNotExist:
        return
    if old.file_path and old.file_path != instance.file_path:
        delete_file_field(old.file_path)
        