"""
seed_demo_data – Create traveller accounts, bookings, and reviews.

Run AFTER seed_listings so that hosts, listings, and slots already exist.

Usage:
    python manage.py seed_demo_data              # full seed
    python manage.py seed_demo_data --dry-run    # preview only
    python manage.py seed_demo_data --flush      # wipe seeded demo data first
"""

import random
import uuid
from datetime import date, time, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Account, HostDetail
from bookings.models import (
    AvailabilityHold,
    Booking,
    BookingItem,
    BookingSource,
    BookingStatus,
    BookingItemStatus,
    BookingStatusHistory,
    CancellationReason,
    PaymentProvider,
    PaymentStatus,
    ProcessedPaymentEvent,
)
from listings.models import ActivitySlot, DurationType, Listing
from reviews.models import Review, ReviewStatus

# ─── Constants ────────────────────────────────────────────────────────────────

PLATFORM_FEE_RATE = Decimal("0.05")
VAT_RATE = Decimal("0.13")

SEED_TRAVELLERS = [
    {
        "email": "traveller1@connectnepal.com",
        "first_name": "Aarav",
        "last_name": "Poudel",
    },
    {
        "email": "traveller2@connectnepal.com",
        "first_name": "Maya",
        "last_name": "Karki",
    },
    {
        "email": "traveller3@connectnepal.com",
        "first_name": "Oliver",
        "last_name": "Bennett",
    },
    {
        "email": "traveller4@connectnepal.com",
        "first_name": "Sakura",
        "last_name": "Tanaka",
    },
]


# ─── Review comments pool ────────────────────────────────────────────────────

REVIEW_COMMENTS = {
    5: [
        "Absolutely incredible experience! The guide was so knowledgeable about the local culture and history. Every moment felt authentic and memorable. Would recommend this to anyone visiting Nepal.",
        "One of the best things I did on my entire Nepal trip. The views were breathtaking and the whole activity was so well-organized. Our guide went above and beyond to make it special.",
        "Perfect from start to finish. The host was warm, welcoming, and clearly passionate about sharing their culture. I learned so much and had an amazing time. Five stars without hesitation.",
        "This exceeded all my expectations. The attention to detail, the beautiful setting, and the genuine hospitality made this a highlight of my travels. Truly unforgettable.",
        "I've traveled extensively through Southeast Asia and this ranks among my top experiences anywhere. The combination of scenery, local insight, and genuine warmth was extraordinary.",
        "What a magical experience! Everything was thoughtfully arranged and the host made us feel like family. The landscape was stunning and the cultural insights were fascinating.",
        "Hands down the best activity I booked in Nepal. The host is incredibly talented and passionate. I left feeling inspired and deeply connected to Nepali culture.",
    ],
    4: [
        "Really enjoyed this experience. The guide was friendly and informative, and the scenery was beautiful. Only minor hiccup was the pickup time running slightly late, but otherwise great.",
        "A wonderful way to spend the day. The host was clearly experienced and showed us things we never would have found on our own. Would have loved a bit more time at the final stop.",
        "Great experience overall. The cultural insights were fascinating and the food was delicious. I'd suggest bringing extra water as it gets quite warm. Highly recommend nonetheless.",
        "Very well organized and the host was a delight. The pace was comfortable and the views were stunning. Wish we had a bit more free time to explore on our own, but still a solid four stars.",
        "Had a really good time. The host was professional and the whole group seemed to enjoy it. The highlight was definitely the local village visit. Minor improvements could be made to the lunch options.",
        "Lovely experience with a knowledgeable host. Learned a lot about Nepali traditions and got to see some beautiful places. The only small issue was the group size was a bit large.",
    ],
    3: [
        "Decent experience but felt a bit rushed. The locations were beautiful but we didn't get enough time at each stop. The guide was friendly though and tried their best.",
        "It was okay. The activity itself was interesting but the organization could be improved. Communication beforehand was a bit unclear about what to bring. Still glad I went though.",
        "Average experience. Some parts were really enjoyable but others felt like filler. The guide was nice but seemed new to the role. Has potential to be great with some refinements.",
    ],
}


# ─── Helper functions ─────────────────────────────────────────────────────────

def _calculate_price(listing, traveller_count, schedule):
    """Mirror the backend pricing logic exactly."""
    price = listing.price_per_person
    count = Decimal(str(traveller_count))
    dtype = schedule["duration_type"]

    if dtype == DurationType.MULTI_DAY:
        multiplier = Decimal(str(max(schedule.get("days", 1), 1)))
    else:
        multiplier = Decimal("1")

    subtotal = (price * count * multiplier).quantize(Decimal("0.01"), ROUND_HALF_UP)
    discount_amount = Decimal("0.00")
    fee_amount = (subtotal * PLATFORM_FEE_RATE).quantize(Decimal("0.01"), ROUND_HALF_UP)
    tax_amount = (subtotal * VAT_RATE).quantize(Decimal("0.01"), ROUND_HALF_UP)
    gross_amount = subtotal + fee_amount + tax_amount - discount_amount

    return {
        "price_per_person": price,
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "fee_amount": fee_amount,
        "tax_amount": tax_amount,
        "gross_amount": gross_amount,
    }


def _build_snapshot(listing):
    """Freeze listing data exactly like the booking service does."""
    primary_img = listing.primary_image
    return {
        "title": listing.title,
        "destination": listing.destination,
        "location": listing.location,
        "price_per_person": str(listing.price_per_person),
        "duration_type": listing.duration_type,
        "duration_days": listing.duration_days,
        "duration_nights": listing.duration_nights,
        "cancellation_policy": listing.cancellation_policy,
        "host_name": listing.host_name,
        "primary_image_url": primary_img.image.url if primary_img else None,
    }


def _make_schedule(listing, slot):
    """Build the schedule dict from a listing + slot pair."""
    schedule = {
        "duration_type": listing.duration_type,
        "start_date": slot.start_date,
        "end_date": slot.end_date,
        "start_time": slot.start_time,
        "end_time": slot.end_time,
    }

    if listing.duration_type == DurationType.MULTI_DAY:
        schedule["days"] = listing.duration_days
        schedule["nights"] = listing.duration_nights
    elif listing.duration_type == DurationType.FULL_DAY:
        schedule["days"] = 1
        schedule["nights"] = 0
    else:  # HOURLY
        schedule["days"] = 1
        schedule["nights"] = 0

    return schedule


# ─── Command ──────────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = "Seed traveller accounts, bookings (with full payment flow), and reviews."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview what would be created without writing to the DB.",
        )
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete previously seeded demo data before re-seeding.",
        )

    def handle(self, *args, **options):
        self.dry_run = options["dry_run"]

        if options["flush"]:
            self._flush()

        # Check prerequisites
        listing_count = Listing.objects.filter(is_active=True).count()
        if listing_count == 0:
            self.stderr.write(self.style.ERROR(
                "No active listings found. Run seed_listings first."
            ))
            return

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== Seed Demo Data ===\n"))

        travellers = self._create_travellers()
        bookings_created = self._create_bookings(travellers)
        reviews_created = self._create_reviews(travellers)

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== Summary ==="))
        self.stdout.write(f"  Travellers : {len(travellers)}")
        self.stdout.write(f"  Bookings   : {bookings_created}")
        self.stdout.write(f"  Reviews    : {reviews_created}")

        if self.dry_run:
            self.stdout.write(self.style.WARNING("\n  DRY RUN – nothing written.\n"))
        else:
            self.stdout.write(self.style.SUCCESS("\n  Done.\n"))

    # ── Flush ─────────────────────────────────────────────────────────────

    def _flush(self):
        emails = [t["email"] for t in SEED_TRAVELLERS]
        travellers = Account.objects.filter(email__in=emails)

        if not travellers.exists():
            self.stdout.write("  Nothing to flush.")
            return

        if self.dry_run:
            self.stdout.write(f"  Would flush {travellers.count()} traveller accounts and all related data.")
            return

        # Reviews by these travellers
        Review.objects.filter(traveller__in=travellers).delete()
        # Bookings by these travellers (cascades to items, history, holds, payment events)
        Booking.objects.filter(traveller__in=travellers).delete()
        # The traveller accounts themselves
        travellers.delete()
        self.stdout.write(self.style.WARNING("  Flushed seed travellers + bookings + reviews."))

    # ── Travellers ────────────────────────────────────────────────────────

    def _create_travellers(self):
        self.stdout.write(self.style.MIGRATE_HEADING("1. Traveller accounts"))
        travellers = []

        for t in SEED_TRAVELLERS:
            if self.dry_run:
                self.stdout.write(f"  [DRY] Would create traveller: {t['email']}")
                travellers.append(None)
                continue

            account, created = Account.objects.get_or_create(
                email=t["email"],
                defaults={
                    "first_name": t["first_name"],
                    "last_name": t["last_name"],
                    "role": "traveller",
                    "is_active": True,
                    "has_completed_onboarding": True,
                    "onboarding_step": 5,
                },
            )
            if created:
                account.set_password("Hello@123")
                account.save()
                self.stdout.write(f"  Created: {t['email']}")
            else:
                self.stdout.write(f"  Exists:  {t['email']}")

            travellers.append(account)

        return travellers

    # ── Bookings ──────────────────────────────────────────────────────────

    def _create_bookings(self, travellers):
        """
        Create a realistic mix of bookings across travellers and listings.

        Strategy:
        - Pick ~30 distinct listing+slot pairs
        - ~15 COMPLETED bookings (past-date slots, needed for reviews)
        - ~10 CONFIRMED bookings (future-date slots)
        - ~3 CANCELLED bookings
        - ~2 EXPIRED bookings
        Each booking has 1 item (keeps it simple and realistic for listings).
        """
        self.stdout.write(self.style.MIGRATE_HEADING("\n2. Bookings"))

        if self.dry_run:
            self.stdout.write("  [DRY] Would create ~30 bookings across 4 travellers.")
            return 30

        listings = list(
            Listing.objects.filter(is_active=True, is_bookable=True)
            .select_related("host__user")
            .prefetch_related("images")
        )

        if len(listings) < 10:
            self.stderr.write(self.style.ERROR(
                "  Need at least 10 active+bookable listings. Run seed_listings first."
            ))
            return 0

        now = timezone.now()
        today = date.today()
        total_created = 0

        # Build booking plan: (traveller, listing, target_status)
        booking_plan = []

        # Each traveller gets 6-9 bookings
        for traveller in travellers:
            sample_listings = random.sample(listings, min(len(listings), 9))
            # First 4-5 → completed, next 3 → confirmed, 1 cancelled, 0-1 expired
            n_completed = random.randint(4, 5)
            n_confirmed = 3
            n_cancelled = 1
            n_expired = random.randint(0, 1)

            idx = 0
            for _ in range(n_completed):
                if idx < len(sample_listings):
                    booking_plan.append((traveller, sample_listings[idx], "completed"))
                    idx += 1
            for _ in range(n_confirmed):
                if idx < len(sample_listings):
                    booking_plan.append((traveller, sample_listings[idx], "confirmed"))
                    idx += 1
            for _ in range(n_cancelled):
                if idx < len(sample_listings):
                    booking_plan.append((traveller, sample_listings[idx], "cancelled"))
                    idx += 1
            for _ in range(n_expired):
                if idx < len(sample_listings):
                    booking_plan.append((traveller, sample_listings[idx], "expired"))
                    idx += 1

        random.shuffle(booking_plan)

        for traveller, listing, target_status in booking_plan:
            try:
                with transaction.atomic():
                    created = self._create_single_booking(
                        traveller, listing, target_status, now, today
                    )
                    if created:
                        total_created += 1
            except Exception as e:
                self.stderr.write(f"  Error creating booking for {listing.title}: {e}")

        self.stdout.write(f"  Created {total_created} bookings.")
        return total_created

    def _create_single_booking(self, traveller, listing, target_status, now, today):
        """Create one booking with all related objects, following backend logic."""
        # ── Determine slot ──
        # For completed/cancelled: need a past-date slot. Create one if needed.
        # For confirmed: use an existing future slot.
        # For expired: use a future slot but with expired payment window.

        traveller_count = random.randint(
            listing.min_group_size or 1,
            min(listing.max_group_size or 4, 4),
        )

        if target_status in ("completed", "cancelled"):
            slot = self._get_or_create_past_slot(listing, today)
        else:
            slot = self._get_future_slot(listing, today)

        if slot is None:
            return False

        # ── Schedule & pricing ──
        schedule = _make_schedule(listing, slot)
        pricing = _calculate_price(listing, traveller_count, schedule)
        snapshot = _build_snapshot(listing)

        # ── Timestamps for realistic history ──
        if target_status == "completed":
            # Booking was created 2-30 days before the slot date
            days_before = random.randint(2, 30)
            created_at = timezone.make_aware(
                timezone.datetime.combine(
                    slot.start_date - timedelta(days=days_before),
                    time(random.randint(8, 20), random.randint(0, 59)),
                )
            )
            paid_at = created_at + timedelta(minutes=random.randint(2, 10))
            completed_at = timezone.make_aware(
                timezone.datetime.combine(
                    slot.end_date or slot.start_date,
                    time(17, 0),
                )
            )
        elif target_status == "confirmed":
            days_before = random.randint(1, 14)
            created_at = now - timedelta(days=days_before)
            paid_at = created_at + timedelta(minutes=random.randint(2, 10))
            completed_at = None
        elif target_status == "cancelled":
            days_before = random.randint(5, 30)
            created_at = timezone.make_aware(
                timezone.datetime.combine(
                    slot.start_date - timedelta(days=days_before),
                    time(random.randint(8, 20), random.randint(0, 59)),
                )
            )
            paid_at = created_at + timedelta(minutes=random.randint(2, 10))
            completed_at = None
        else:  # expired
            created_at = now - timedelta(hours=random.randint(2, 48))
            paid_at = None
            completed_at = None

        expires_at = created_at + timedelta(minutes=15)

        # ── Booking status mapping ──
        status_map = {
            "completed": BookingStatus.COMPLETED,
            "confirmed": BookingStatus.CONFIRMED,
            "cancelled": BookingStatus.CANCELLED,
            "expired": BookingStatus.EXPIRED,
        }
        payment_status_map = {
            "completed": PaymentStatus.PAYMENT_SUCCEEDED,
            "confirmed": PaymentStatus.PAYMENT_SUCCEEDED,
            "cancelled": PaymentStatus.PAYMENT_REFUNDED,
            "expired": PaymentStatus.PAYMENT_PENDING,
        }

        booking_status = status_map[target_status]
        payment_status = payment_status_map[target_status]
        item_status_map = {
            "completed": BookingItemStatus.COMPLETED,
            "confirmed": BookingItemStatus.CONFIRMED,
            "cancelled": BookingItemStatus.CANCELLED,
            "expired": BookingItemStatus.EXPIRED,
        }
        item_status = item_status_map[target_status]

        # ── Create Booking ──
        booking = Booking(
            traveller=traveller,
            source=BookingSource.DIRECT,
            status=booking_status,
            expires_at=expires_at,
            payment_status=payment_status,
            payment_provider=PaymentProvider.ESEWA if paid_at else None,
            payment_intent_ref=f"esewa_{uuid.uuid4().hex[:16]}" if paid_at else "",
            transaction_id=f"TXN-{uuid.uuid4().hex[:12].upper()}" if paid_at else "",
            paid_amount=pricing["gross_amount"] if paid_at else None,
            currency="NPR",
            paid_at=paid_at,
            subtotal=pricing["subtotal"],
            discount_amount=pricing["discount_amount"],
            fee_amount=pricing["fee_amount"],
            tax_amount=pricing["tax_amount"],
            gross_amount=pricing["gross_amount"],
            quoted_total=pricing["gross_amount"],
            idempotency_key=uuid.uuid4().hex,
        )

        # Handle cancellation fields
        if target_status == "cancelled":
            booking.cancelled_at = paid_at + timedelta(hours=random.randint(1, 24))
            booking.cancellation_reason = CancellationReason.TRAVELLER_REQUEST
            booking.cancellation_note = "Plans changed, had to cancel."
            booking.cancelled_by = traveller

        booking.save()

        # Set reference: BK-{YYYYMMDD}-{id:06d}
        ref_date = slot.start_date or today
        booking.reference = f"BK-{ref_date.strftime('%Y%m%d')}-{booking.id:06d}"
        booking.save(update_fields=["reference"])

        # ── AvailabilityHold (released for all except pending) ──
        hold = AvailabilityHold.objects.create(
            listing=listing,
            traveller=traveller,
            duration_type=listing.duration_type,
            start_date=slot.start_date,
            end_date=slot.end_date,
            start_time=slot.start_time,
            end_time=slot.end_time,
            traveller_count=traveller_count,
            expires_at=expires_at,
            is_released=target_status != "expired",
            released_at=paid_at if target_status != "expired" else None,
        )

        # ── BookingItem ──
        item = BookingItem.objects.create(
            booking=booking,
            listing=listing,
            slot=slot,
            duration_type=listing.duration_type,
            start_date=slot.start_date,
            end_date=slot.end_date,
            start_time=slot.start_time,
            end_time=slot.end_time,
            days=schedule.get("days", 1),
            nights=schedule.get("nights", 0),
            traveller_count=traveller_count,
            status=item_status,
            snapshot=snapshot,
            price_per_person=pricing["price_per_person"],
            subtotal=pricing["subtotal"],
            discount_amount=pricing["discount_amount"],
            fee_amount=pricing["fee_amount"],
            tax_amount=pricing["tax_amount"],
            gross_amount=pricing["gross_amount"],
            quoted_total=pricing["gross_amount"],
            hold=hold,
            completed_at=completed_at,
        )

        # ── ProcessedPaymentEvent (for paid bookings) ──
        if paid_at:
            ProcessedPaymentEvent.objects.create(
                event_id=f"seed_{uuid.uuid4().hex[:20]}",
                booking=booking,
            )

        # ── BookingStatusHistory ──
        # Step 1: creation
        BookingStatusHistory.objects.create(
            booking=booking,
            from_status="",
            to_status=BookingStatus.PENDING_PAYMENT,
            note="Booking created (seeded)",
        )

        if target_status in ("completed", "confirmed"):
            # Step 2: payment confirmed
            BookingStatusHistory.objects.create(
                booking=booking,
                from_status=BookingStatus.PENDING_PAYMENT,
                to_status=BookingStatus.CONFIRMED,
                note="Payment confirmed via eSewa (seeded)",
            )
            # Item-level history
            BookingStatusHistory.objects.create(
                booking=booking,
                booking_item=item,
                from_status=BookingItemStatus.PENDING_PAYMENT,
                to_status=BookingItemStatus.CONFIRMED,
                note="Payment confirmed (seeded)",
            )

        if target_status == "completed":
            # Step 3: host marked completed
            BookingStatusHistory.objects.create(
                booking=booking,
                from_status=BookingStatus.CONFIRMED,
                to_status=BookingStatus.COMPLETED,
                note="Activity completed (seeded)",
            )
            BookingStatusHistory.objects.create(
                booking=booking,
                booking_item=item,
                from_status=BookingItemStatus.CONFIRMED,
                to_status=BookingItemStatus.COMPLETED,
                note="Activity completed (seeded)",
            )

        if target_status == "cancelled":
            BookingStatusHistory.objects.create(
                booking=booking,
                from_status=BookingStatus.CONFIRMED,
                to_status=BookingStatus.CANCELLED,
                note="Cancelled by traveller (seeded)",
                changed_by=traveller,
            )
            BookingStatusHistory.objects.create(
                booking=booking,
                booking_item=item,
                from_status=BookingItemStatus.CONFIRMED,
                to_status=BookingItemStatus.CANCELLED,
                note="Cancelled by traveller (seeded)",
                changed_by=traveller,
            )

        if target_status == "expired":
            BookingStatusHistory.objects.create(
                booking=booking,
                from_status=BookingStatus.PENDING_PAYMENT,
                to_status=BookingStatus.EXPIRED,
                note="Payment window expired (seeded)",
            )
            BookingStatusHistory.objects.create(
                booking=booking,
                booking_item=item,
                from_status=BookingItemStatus.PENDING_PAYMENT,
                to_status=BookingItemStatus.EXPIRED,
                note="Payment window expired (seeded)",
            )

        # ── Increment booking_count on listing (only for confirmed/completed) ──
        if target_status in ("completed", "confirmed"):
            from django.db.models import F
            Listing.objects.filter(pk=listing.pk).update(
                booking_count=F("booking_count") + 1
            )

        return True

    def _get_or_create_past_slot(self, listing, today):
        """Get or create a slot with a past date for completed/cancelled bookings."""
        # Try to find an existing past slot
        past_slot = (
            ActivitySlot.objects
            .filter(listing=listing, start_date__lt=today, is_active=True)
            .order_by("-start_date")
            .first()
        )
        if past_slot:
            return past_slot

        # Create a past-date slot
        days_ago = random.randint(5, 60)
        start = today - timedelta(days=days_ago)

        if listing.duration_type == DurationType.MULTI_DAY:
            end = start + timedelta(days=max(listing.duration_days - 1, 0))
            return ActivitySlot.objects.create(
                listing=listing,
                start_date=start,
                end_date=end,
                start_time=None,
                end_time=None,
                capacity=listing.max_group_size or 10,
                is_active=True,
            )
        elif listing.duration_type == DurationType.HOURLY:
            hours_val = int(listing.average_duration_hours or 4)
            st = time(9, 0)
            et = time(min(9 + hours_val, 23), 0)
            return ActivitySlot.objects.create(
                listing=listing,
                start_date=start,
                end_date=start,
                start_time=st,
                end_time=et,
                capacity=listing.max_group_size or 10,
                is_active=True,
            )
        else:  # FULL_DAY
            return ActivitySlot.objects.create(
                listing=listing,
                start_date=start,
                end_date=start,
                start_time=None,
                end_time=None,
                capacity=listing.max_group_size or 10,
                is_active=True,
            )

    def _get_future_slot(self, listing, today):
        """Get an existing future slot for confirmed/expired bookings."""
        return (
            ActivitySlot.objects
            .filter(listing=listing, start_date__gte=today, is_active=True)
            .order_by("start_date")
            .first()
        )

    # ── Reviews ───────────────────────────────────────────────────────────

    def _create_reviews(self, travellers):
        """
        Create reviews for completed bookings.

        Not every completed booking gets a review (realistic).
        ~70% of completed bookings will have reviews.
        """
        self.stdout.write(self.style.MIGRATE_HEADING("\n3. Reviews"))

        if self.dry_run:
            self.stdout.write("  [DRY] Would create reviews for ~70% of completed bookings.")
            return 0

        # Get all completed booking items for our seeded travellers
        completed_items = (
            BookingItem.objects
            .filter(
                booking__traveller__in=travellers,
                status=BookingItemStatus.COMPLETED,
                listing__isnull=False,
            )
            .select_related("booking", "booking__traveller", "listing")
        )

        total_created = 0

        for item in completed_items:
            # Skip ~30% for realism
            if random.random() < 0.30:
                continue

            # Skip if review already exists for this booking item
            if Review.objects.filter(booking_item=item).exists():
                continue

            # Skip if this traveller already reviewed this listing
            if Review.objects.filter(
                traveller=item.booking.traveller,
                listing=item.listing,
            ).exclude(status=ReviewStatus.USER_DELETED).exists():
                continue

            # Weighted rating: skew positive (realistic for tourism)
            rating = random.choices(
                [5, 4, 3],
                weights=[50, 35, 15],
                k=1,
            )[0]

            comment = random.choice(REVIEW_COMMENTS[rating])

            # Review created a few days after completion
            days_after = random.randint(1, 14)
            review_date = (item.completed_at or timezone.now()) + timedelta(days=days_after)
            # Don't create reviews in the future
            if review_date > timezone.now():
                review_date = timezone.now() - timedelta(hours=random.randint(1, 48))

            try:
                with transaction.atomic():
                    Review.objects.create(
                        traveller=item.booking.traveller,
                        listing=item.listing,
                        booking_item=item,
                        rating=rating,
                        comment=comment,
                        status=ReviewStatus.PUBLISHED,
                    )
                    total_created += 1
            except Exception as e:
                self.stderr.write(f"  Error creating review: {e}")

        # Recalculate ratings for all reviewed listings
        if total_created > 0:
            self._recalculate_all_ratings()

        self.stdout.write(f"  Created {total_created} reviews.")
        return total_created

    def _recalculate_all_ratings(self):
        """
        Recalculate rating_average and rating_count for all listings
        that have published reviews. Mirrors _recalculate_listing_rating().
        """
        from django.db.models import Avg, Count

        listings_with_reviews = (
            Listing.objects
            .filter(reviews__status=ReviewStatus.PUBLISHED)
            .distinct()
        )

        for listing in listings_with_reviews:
            result = (
                Review.objects
                .filter(listing=listing, status=ReviewStatus.PUBLISHED)
                .aggregate(avg=Avg("rating"), cnt=Count("id"))
            )
            listing.rating_average = result["avg"] or 0
            listing.rating_count = result["cnt"] or 0
            listing.save(update_fields=["rating_average", "rating_count"])

        self.stdout.write(f"  Recalculated ratings for {listings_with_reviews.count()} listings.")