from django.db.models.signals import post_delete
from django.dispatch import receiver

from utils.files import delete_file_field
from .models import ComplaintEvidence


@receiver(post_delete, sender=ComplaintEvidence)
def delete_complaint_evidence_file_on_delete(sender, instance, **kwargs):
    """
    Remove evidence file from storage when a ComplaintEvidence record is deleted.

    Also fires on cascade delete when the parent Complaint is deleted, so
    evidence files are cleaned up in both the individual-delete and
    complaint-delete paths.

    Evidence files are upload-once — they are never replaced in place, only
    deleted and re-uploaded — so no pre_save replacement handler is needed.
    """
    delete_file_field(instance.file)
    