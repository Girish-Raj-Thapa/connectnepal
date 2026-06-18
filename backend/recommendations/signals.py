from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from accounts.models import Account, TravellerDetail
from recommendations.services.cache_versioning_service import (
    bump_user_preference_generation,
)

_CITY_CAPTURE_MISSING = object()


@receiver(post_save, sender=TravellerDetail)
def bump_for_you_generation_on_preference_save(sender, instance, **kwargs):
    bump_user_preference_generation(instance.user_id)


@receiver(post_delete, sender=TravellerDetail)
def bump_for_you_generation_on_preference_delete(sender, instance, **kwargs):
    bump_user_preference_generation(instance.user_id)


@receiver(pre_save, sender=Account)
def _capture_account_city(sender, instance, **kwargs):
    """
    Snapshot the current city value before save so post_save can detect actual value changes rather than firing on every Account save.
    """
    if not instance.pk:
        return
    try:
        instance._reco_old_city = Account.objects.values_list(
            'city', flat=True,
        ).get(pk=instance.pk)
    except Account.DoesNotExist:
        instance._reco_old_city = _CITY_CAPTURE_MISSING


@receiver(post_save, sender=Account)
def bump_for_you_generation_on_city_change(sender, instance, created, **kwargs):
    """
    Bump user_preference_generation when Account.city changes so the /for-you/ cache is invalidated.

    Only fires for traveller accounts and only when the city value actually changes. New accounts are skipped since they have no cached recommendations yet.
    """
    if created:
        return

    if instance.role != Account.Role.TRAVELLER:
        return

    update_fields = kwargs.get('update_fields')
    if update_fields is not None and 'city' not in update_fields:
        return

    old_city = getattr(instance, '_reco_old_city', _CITY_CAPTURE_MISSING)
    if old_city is not _CITY_CAPTURE_MISSING and old_city == instance.city:
        return

    bump_user_preference_generation(instance.pk)
