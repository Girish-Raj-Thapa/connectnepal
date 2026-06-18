from django.core.management.base import BaseCommand, CommandError

from listings.models import Listing
from listings.services.slot_generation_service import (
    generate_slots_for_listing,
    generate_slots_for_all_listings,
)


class Command(BaseCommand):
    help = (
        "Idempotently generate ActivitySlots from ListingSchedule templates. "
        "Safe to run multiple times — existing slots are never overwritten."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--listing",
            type=int,
            metavar="ID",
            help="Generate slots for a single listing ID only (default: all listings)",
        )
        parser.add_argument(
            "--days",
            type=int,
            metavar="N",
            help="Override the advance_days horizon (default: each schedule's own advance_days)",
        )

    def handle(self, *args, **options):
        listing_id = options.get("listing")
        days_ahead = options.get("days")

        if listing_id:
            try:
                listing = Listing.objects.get(pk=listing_id)
            except Listing.DoesNotExist:
                raise CommandError(f"Listing {listing_id} does not exist.")
            created = generate_slots_for_listing(listing, days_ahead=days_ahead)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Listing {listing_id} ({listing.title}): created {created} slot(s)."
                )
            )
        else:
            created = generate_slots_for_all_listings(days_ahead=days_ahead)
            self.stdout.write(
                self.style.SUCCESS(f"All listings: created {created} slot(s) total.")
            )
