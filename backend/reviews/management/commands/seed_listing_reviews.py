"""
Management command to seed demo reviews for a specific listing.

Usage:
    python manage.py seed_listing_reviews
    python manage.py seed_listing_reviews --slug teej-womens-festival-and-temple-experience-c2bc84
    python manage.py seed_listing_reviews --flush   # delete seeded reviews then re-seed
    python manage.py seed_listing_reviews --dry-run
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Account
from listings.models import Listing
from reviews.models import Review, ReviewStatus

DEFAULT_SLUG = "teej-womens-festival-and-temple-experience-c2bc84"

SEED_REVIEWS = [
    {
        "email": "reviewer1@connectnepal.com",
        "first_name": "Priya",
        "last_name": "Sharma",
        "rating": 5,
        "comment": (
            "Absolutely magical experience! The guide was incredibly knowledgeable about Teej "
            "traditions and the significance of each ritual at Pashupatinath. Watching hundreds "
            "of women in vibrant red sarees singing and dancing was something I'll never forget. "
            "Highly recommend for anyone wanting to understand Nepali culture on a deeper level."
        ),
    },
    {
        "email": "reviewer2@connectnepal.com",
        "first_name": "Anita",
        "last_name": "Thapa",
        "rating": 5,
        "comment": (
            "As a Nepali woman living abroad, joining this tour during Teej brought me to tears. "
            "The host made sure we arrived before the crowds at the temple and explained every "
            "ritual with such warmth. The traditional sel roti snack included was a lovely touch. "
            "Perfect blend of cultural immersion and personal storytelling."
        ),
    },
    {
        "email": "reviewer3@connectnepal.com",
        "first_name": "Sofia",
        "last_name": "Müller",
        "rating": 4,
        "comment": (
            "Really wonderful experience. Coming from Germany I had no idea about Teej but left "
            "with a genuine appreciation for this festival. The temple visit was serene early "
            "morning but got very busy by mid-morning — worth knowing in advance. Guide was "
            "patient with all our questions. Docking one star only because parking was chaotic."
        ),
    },
    {
        "email": "reviewer4@connectnepal.com",
        "first_name": "Meena",
        "last_name": "Rai",
        "rating": 5,
        "comment": (
            "I have celebrated Teej my whole life but never truly understood all the stories "
            "behind each ritual. This experience gave me that deeper knowledge. The host took us "
            "to a quieter ghat away from the main tourist crowd which made it feel authentic and "
            "spiritual. Booking again next year with my mother."
        ),
    },
    {
        "email": "reviewer5@connectnepal.com",
        "first_name": "Jessica",
        "last_name": "Park",
        "rating": 4,
        "comment": (
            "One of the highlights of my Nepal trip. The focus on women's stories and the "
            "significance of Teej as a festival of empowerment was eye-opening. Our guide "
            "Sunita was brilliant — articulate, passionate, and very welcoming to questions. "
            "Slightly long walking segments in the heat but totally worth it."
        ),
    },
    {
        "email": "reviewer6@connectnepal.com",
        "first_name": "Kavya",
        "last_name": "Nair",
        "rating": 3,
        "comment": (
            "Good experience overall. The temple visit was peaceful and the guide's cultural "
            "explanation was helpful. I felt the group was a bit large (12 people) which made "
            "it hard to hear at times during the main ritual area. Would have preferred a "
            "smaller, more intimate group. The festival atmosphere itself more than made up for it."
        ),
    },
    {
        "email": "reviewer7@connectnepal.com",
        "first_name": "Rina",
        "last_name": "Gurung",
        "rating": 5,
        "comment": (
            "A genuinely moving experience. Our host was thoughtful enough to explain what "
            "photography was and wasn't appropriate, which I really respected. The walk through "
            "the old bazaar to reach the temple, with women singing Teej songs along the way, "
            "was something no guidebook can prepare you for. Beautifully organised."
        ),
    },
]


class Command(BaseCommand):
    help = "Seed 7 demo reviews for the Teej festival listing (or a given slug)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--slug",
            default=DEFAULT_SLUG,
            help="Listing slug to seed reviews for.",
        )
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete previously seeded reviews for this listing before re-seeding.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Execute logic but roll back all DB changes.",
        )

    def handle(self, *args, **opts):
        slug = opts["slug"]
        flush = opts["flush"]
        dry_run = opts["dry_run"]

        try:
            listing = Listing.objects.get(slug=slug)
        except Listing.DoesNotExist:
            raise CommandError(f"No listing found with slug '{slug}'.")

        self.stdout.write(f"Target listing: [{listing.pk}] {listing.title}")

        with transaction.atomic():
            if flush:
                seeded_emails = [r["email"] for r in SEED_REVIEWS]
                deleted, _ = Review.objects.filter(
                    listing=listing,
                    traveller__email__in=seeded_emails,
                ).delete()
                self.stdout.write(self.style.WARNING(f"Flushed {deleted} existing seeded review(s)."))

            created_count = 0
            skipped_count = 0

            for data in SEED_REVIEWS:
                traveller, _ = Account.objects.get_or_create(
                    email=data["email"],
                    defaults={
                        "role": Account.Role.TRAVELLER,
                        "first_name": data["first_name"],
                        "last_name": data["last_name"],
                        "is_active": True,
                    },
                )

                review, created = Review.objects.get_or_create(
                    listing=listing,
                    traveller=traveller,
                    defaults={
                        "rating": data["rating"],
                        "comment": data["comment"],
                        "status": ReviewStatus.PUBLISHED,
                    },
                )

                if created:
                    created_count += 1
                    self.stdout.write(
                        f"  + [{data['rating']}★] {traveller.full_name} — created"
                    )
                else:
                    skipped_count += 1
                    self.stdout.write(
                        f"  ~ [{data['rating']}★] {traveller.full_name} — already exists, skipped"
                    )

            if dry_run:
                transaction.set_rollback(True)
                self.stdout.write(self.style.WARNING("DRY RUN — no changes persisted."))
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"\nDone. Created: {created_count}, Skipped: {skipped_count}."
                    )
                )