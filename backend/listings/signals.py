from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from utils.files import delete_file_field
from .models import Listing, ListingImage, ListingSchedule


# ListingImage.image + ListingImage.thumbnail

@receiver(post_delete, sender=ListingImage)
def delete_listing_image_files_on_delete(sender, instance, **kwargs):
    """
    Remove both the full-size image and its thumbnail from storage when a
    ListingImage record is deleted (including cascade deletes when a Listing
    is deleted).
    """
    delete_file_field(instance.image)
    delete_file_field(instance.thumbnail)


@receiver(pre_save, sender=ListingImage)
def delete_old_listing_image_files_on_replace(sender, instance, **kwargs):
    """
    Remove old image/thumbnail files from storage when they are replaced.

    thumbnail is auto-generated on save, so if image changes the old thumbnail
    is also stale and must be removed before the new one is written.
    """
    if not instance.pk:
        return
    try:
        old = ListingImage.objects.get(pk=instance.pk)
    except ListingImage.DoesNotExist:
        return
    if old.image and old.image != instance.image:
        delete_file_field(old.image)
    if old.thumbnail and old.thumbnail != instance.thumbnail:
        delete_file_field(old.thumbnail)


# ---------------------------------------------------------------------------
# Slot generation — trigger immediately on publish and schedule change
# ---------------------------------------------------------------------------

@receiver(pre_save, sender=Listing)
def _capture_listing_bookable_state(sender, instance, **kwargs):
    """
    Stash the current is_bookable value on the instance before it is saved
    so the post_save signal can detect a False → True transition.
    """
    if not instance.pk:
        instance._was_bookable = False
        return
    try:
        instance._was_bookable = Listing.objects.values_list(
            "is_bookable", flat=True
        ).get(pk=instance.pk)
    except Listing.DoesNotExist:
        instance._was_bookable = False


@receiver(post_save, sender=Listing)
def generate_slots_on_publish(sender, instance, **kwargs):
    """
    Fire immediate slot generation when a listing is published.

    Only triggers when is_bookable transitions False → True so that routine
    listing edits (title, description, etc.) do not queue unnecessary tasks.
    The listing must also be active (not soft-deleted) to be worth generating.
    """
    was_bookable = getattr(instance, "_was_bookable", True)
    if instance.is_bookable and instance.is_active and not was_bookable:
        from listings.tasks import generate_slots_for_listing_task
        transaction.on_commit(
            lambda listing_id=instance.pk: generate_slots_for_listing_task.delay(listing_id)
        )


@receiver(post_save, sender=ListingSchedule)
def regenerate_slots_on_schedule_change(sender, instance, **kwargs):
    """
    Regenerate slots for the affected listing when a schedule is created
    or updated so that changes take effect immediately rather than at 1am.

    The task deletes future unbooked slots and rebuilds from the current
    schedule state — booked slots are never touched.
    """
    from listings.tasks import regenerate_slots_for_listing_task
    transaction.on_commit(
        lambda listing_id=instance.listing_id: regenerate_slots_for_listing_task.delay(listing_id)
    )


# ---------------------------------------------------------------------------
# Recommendation reindex — trigger on listing field changes
# ---------------------------------------------------------------------------

@receiver(pre_save, sender=Listing)
def _capture_listing_reco_fields(sender, instance, **kwargs):
    """
    Snapshot recommendation-relevant field values before save so the post_save signal can detect actual value changes (not just field presence in update_fields).
    """
    if not instance.pk:
        return
    try:
        from recommendations.constants import REINDEX_TRIGGER_FIELDS
        old = Listing.objects.only(*REINDEX_TRIGGER_FIELDS).get(pk=instance.pk)
        instance._reco_old_values = {
            f: getattr(old, f) for f in REINDEX_TRIGGER_FIELDS
        }
    except Listing.DoesNotExist:
        instance._reco_old_values = None


@receiver(post_save, sender=Listing)
def trigger_reco_reindex_on_listing_change(sender, instance, created, **kwargs):
    """
    Queue a recommendation reindex task when a listing is created or when recommendation-relevant fields actually change value.

    For new listings: reindex if the listing is visible (active + bookable).
    For updates: compare current values against pre-save snapshot to avoid noisy reindexing on unrelated saves.
    """
    if created:
        if instance.is_active and instance.is_bookable:
            _dispatch_reco_reindex(instance.pk)
        return

    from recommendations.constants import REINDEX_TRIGGER_FIELDS

    # Fast path: if update_fields is provided and has no overlap, skip
    update_fields = kwargs.get('update_fields')
    if update_fields is not None:
        if not REINDEX_TRIGGER_FIELDS.intersection(update_fields):
            return

    # Compare actual values against pre-save snapshot
    old_values = getattr(instance, '_reco_old_values', None)
    if old_values is not None:
        changed = any(
            getattr(instance, f) != old_values.get(f)
            for f in REINDEX_TRIGGER_FIELDS
        )
        if not changed:
            return

    _dispatch_reco_reindex(instance.pk)


def _dispatch_reco_reindex(listing_id: int):
    """
    Dispatch the recommendation reindex task.
    Import inside function to avoid circular imports and to allow the
    recommendations app to be absent without breaking listings.
    """
    try:
        from recommendations.tasks import reindex_listing_task
        transaction.on_commit(
            lambda queued_listing_id=listing_id: reindex_listing_task.delay(queued_listing_id)
        )
    except ImportError:
        pass  # recommendations app not installed
    except Exception:
        # Don't let recommendation failures break listing saves
        import logging
        logging.getLogger('listings').exception(
            "Failed to dispatch reco reindex for listing %d", listing_id
        )
        
