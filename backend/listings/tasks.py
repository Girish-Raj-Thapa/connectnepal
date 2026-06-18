from celery import shared_task
from .services.slot_generation_service import generate_slots_for_all_listings, generate_slots_for_listing


@shared_task(
    name="listings.tasks.generate_slots_task",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def generate_slots_task(self):
    """
    Run nightly via Celery beat (1am).

    Idempotently fills ActivitySlot records for the next N days on every
    active listing that has at least one active ListingSchedule.
    """
    try:
        count = generate_slots_for_all_listings()
        return {"slots_created": count}
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(
    name="listings.tasks.generate_slots_for_listing_task",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def generate_slots_for_listing_task(self, listing_id):
    """
    Generate slots for a single listing immediately.

    Triggered when a listing is published (is_bookable flips to True) so
    that travellers can book the same day without waiting for the nightly run.
    """
    from .models import Listing
    try:
        listing = Listing.objects.get(pk=listing_id)
        count = generate_slots_for_listing(listing)
        return {"listing_id": listing_id, "slots_created": count}
    except Listing.DoesNotExist:
        return {"listing_id": listing_id, "error": "not found"}
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(
    name="listings.tasks.regenerate_slots_for_listing_task",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def regenerate_slots_for_listing_task(self, listing_id):
    """
    Delete future unbooked slots for a listing and regenerate from the
    current schedule.

    Triggered when a ListingSchedule is created or updated so that
    schedule changes take effect immediately rather than waiting for the
    nightly run.

    Safety rule: slots that already have a CONFIRMED or PENDING_PAYMENT
    BookingItem are never touched — only genuinely unbooked future slots
    are removed.
    """
    from datetime import date
    from django.db import transaction
    from .models import Listing, ActivitySlot
    from bookings.models import BookingItemStatus

    try:
        listing = Listing.objects.get(pk=listing_id)
    except Listing.DoesNotExist:
        return {"listing_id": listing_id, "error": "not found"}

    try:
        with transaction.atomic():
            today = date.today()

            # IDs of future slots that have at least one active booking item
            booked_slot_ids = set(
                ActivitySlot.objects.filter(
                    listing_id=listing_id,
                    start_date__gte=today,
                    booking_items__status__in=[
                        BookingItemStatus.CONFIRMED,
                        BookingItemStatus.PENDING_PAYMENT,
                    ],
                ).values_list("id", flat=True)
            )

            deleted, _ = (
                ActivitySlot.objects
                .filter(listing_id=listing_id, start_date__gte=today)
                .exclude(id__in=booked_slot_ids)
                .delete()
            )

            created = generate_slots_for_listing(listing)

        return {
            "listing_id": listing_id,
            "slots_deleted": deleted,
            "slots_created": created,
        }
    except Exception as exc:
        raise self.retry(exc=exc)
