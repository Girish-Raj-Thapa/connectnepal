from datetime import date, datetime, time, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from accounts.models import Account, HostDetail
from bookings.models import (
    AvailabilityHold,
    Booking,
    BookingItem,
    BookingItemStatus,
    BookingStatus,
)
from bookings.serializers import BookingDetailSerializer
from bookings.services.booking_lifecycle_service import (
    cancel_booking,
    expire_stale_bookings,
    host_mark_completed,
)
from bookings.services.booking_service import create_booking, create_booking_from_trip_plan
from bookings.services.pricing_service import (
    PLATFORM_FEE_RATE,
    VAT_RATE,
    _calculate_item_price,
    _check_slot_capacity,
)
from listings.models import (
    ActivitySlot,
    ActivityType,
    CancellationPolicy,
    Category,
    DifficultyLevel,
    DurationType,
    Listing,
)
from listings.services import listing_service
from notifications.constants import NotificationType
from notifications.models import Notification
from packages.models import Package
from reviews.models import Review, ReviewStatus
from tests.factories import (
    AccountFactory,
    ActivitySlotFactory,
    AvailabilityHoldFactory,
    BookingFactory,
    BookingItemFactory,
    HostDetailFactory,
    ListingFactory,
    TravellerFactory,
)
from trip_planner.models import TripPlanner, TripPlannerItem, TripStatus
from utils.exceptions import ServiceError


# ===========================================================================
# EXISTING — keep intact
# ===========================================================================

class BookingSoftDeleteSerializerTests(TestCase):
    account_seq = 0

    def create_account(self, role, **overrides):
        self.__class__.account_seq += 1
        seq = self.__class__.account_seq
        defaults = {
            "email": f"{role}-{seq}@example.com",
            "role": role,
            "first_name": "Test",
            "last_name": "User",
            "is_active": True,
        }
        defaults.update(overrides)
        return Account.objects.create(**defaults)

    def create_host(self):
        user = self.create_account(Account.Role.HOST)
        host = HostDetail.objects.create(
            user=user,
            business_name="Archive Host Co.",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        return user, host

    def create_listing(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Original Listing Title",
            "description": "A listing kept for booking history tests.",
            "destination": "Pokhara",
            "location": "Lakeside",
            "category": Category.CULTURAL,
            "activity_type": ActivityType.CITY_TOUR,
            "difficulty_level": DifficultyLevel.EASY,
            "ideal_for": ["solo"],
            "price_per_person": "1200.00",
            "duration_type": DurationType.FULL_DAY,
            "duration_days": 1,
            "duration_nights": 0,
            "tags": ["city"],
            "what_to_bring": "Camera",
            "requirements": "None",
            "inclusions": ["Guide"],
            "exclusions": ["Meals"],
            "cancellation_policy": CancellationPolicy.MODERATE,
            "languages_offered": ["english"],
            "best_seasons": ["autumn"],
            "is_active": True,
            "is_bookable": True,
        }
        defaults.update(overrides)
        return Listing.objects.create(**defaults)

    def create_package(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Original Package Title",
            "slug": "original-package-title",
            "description": "A package kept for booking history tests.",
            "duration_days": 3,
            "duration_nights": 2,
            "total_price": "9000.00",
            "max_group_size": 6,
            "is_active": True,
            "is_bookable": True,
        }
        defaults.update(overrides)
        return Package.objects.create(**defaults)

    def test_booking_detail_uses_snapshots_for_soft_deleted_targets(self):
        traveller = self.create_account(Account.Role.TRAVELLER)
        _, host = self.create_host()
        listing = self.create_listing(host)
        package = self.create_package(host)
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.CONFIRMED,
            expires_at=timezone.now(),
            source="direct",
        )

        listing_item = BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            days=1,
            nights=0,
            traveller_count=2,
            status=BookingItemStatus.COMPLETED,
            snapshot={
                "title": "Snapshot Listing Title",
            },
            price_per_person="1200.00",
            subtotal="2400.00",
            quoted_total="2400.00",
            completed_at=timezone.now(),
        )
        package_item = BookingItem.objects.create(
            booking=booking,
            package=package,
            duration_type="package",
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            days=3,
            nights=2,
            traveller_count=2,
            status=BookingItemStatus.CONFIRMED,
            snapshot={
                "package_title": "Snapshot Package Title",
            },
            price_per_person="9000.00",
            subtotal="18000.00",
            quoted_total="18000.00",
        )
        Review.objects.create(
            traveller=traveller,
            listing=listing,
            booking_item=listing_item,
            rating=4,
            comment="Historical review",
            status=ReviewStatus.USER_DELETED,
        )

        listing.title = "Live Listing Title"
        listing.is_active = False
        listing.is_bookable = False
        listing.save(update_fields=["title", "is_active", "is_bookable"])

        package.title = "Live Package Title"
        package.is_active = False
        package.is_bookable = False
        package.save(update_fields=["title", "is_active", "is_bookable"])

        data = BookingDetailSerializer(booking).data
        items_by_type = {item["target_type"]: item for item in data["items"]}

        self.assertEqual(items_by_type["listing"]["title"], "Snapshot Listing Title")
        self.assertEqual(items_by_type["listing"]["listing_title"], "Snapshot Listing Title")
        self.assertIsNone(items_by_type["listing"]["review_id"])
        self.assertFalse(items_by_type["listing"]["has_review"])
        self.assertIsNone(items_by_type["listing"]["review_status"])

        self.assertEqual(items_by_type["package"]["title"], "Snapshot Package Title")
        self.assertEqual(items_by_type["package"]["package_title"], "Snapshot Package Title")


class BookingAvailabilityGuardTests(TestCase):
    account_seq = 0

    def create_account(self, role, **overrides):
        self.__class__.account_seq += 1
        seq = self.__class__.account_seq
        defaults = {
            "email": f"{role}-{seq}@example.com",
            "role": role,
            "first_name": "Test",
            "last_name": "User",
            "is_active": True,
        }
        defaults.update(overrides)
        return Account.objects.create(**defaults)

    def create_host(self):
        user = self.create_account(Account.Role.HOST)
        host = HostDetail.objects.create(
            user=user,
            business_name="Booking Guard Co.",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        return user, host

    def create_listing(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Guarded Listing",
            "description": "Listing used for booking availability guard tests.",
            "destination": "Kathmandu",
            "location": "Durbar Marg",
            "category": Category.CULTURAL,
            "activity_type": ActivityType.CITY_TOUR,
            "difficulty_level": DifficultyLevel.EASY,
            "ideal_for": ["solo"],
            "price_per_person": "1500.00",
            "duration_type": DurationType.FULL_DAY,
            "duration_days": 1,
            "duration_nights": 0,
            "tags": ["culture"],
            "what_to_bring": "Comfortable shoes",
            "requirements": "None",
            "inclusions": ["Guide"],
            "exclusions": ["Meals"],
            "cancellation_policy": CancellationPolicy.MODERATE,
            "languages_offered": ["english"],
            "best_seasons": ["autumn"],
            "is_active": True,
            "is_bookable": True,
        }
        defaults.update(overrides)
        return Listing.objects.create(**defaults)

    def test_create_booking_rejects_listing_from_inactive_host(self):
        traveller = self.create_account(Account.Role.TRAVELLER)
        host_user, host = self.create_host()
        listing = self.create_listing(host)
        slot = ActivitySlot.objects.create(
            listing=listing,
            start_date=timezone.now().date() + timedelta(days=3),
            end_date=timezone.now().date() + timedelta(days=3),
            capacity=5,
            is_active=True,
        )

        host_user.is_active = False
        host_user.save(update_fields=["is_active"])

        with self.assertRaises(ServiceError) as exc:
            create_booking(
                traveller,
                {
                    "items": [
                        {
                            "listing_id": listing.pk,
                            "slot_id": slot.pk,
                            "traveller_count": 1,
                        }
                    ]
                },
            )

        self.assertEqual(
            str(exc.exception.detail),
            f"Listing '{listing.title}' is not available for booking.",
        )

    def test_create_booking_from_trip_plan_rejects_removed_trip_plan_item(self):
        traveller = self.create_account(Account.Role.TRAVELLER)
        host_user, host = self.create_host()
        listing = self.create_listing(host)
        slot = ActivitySlot.objects.create(
            listing=listing,
            start_date=timezone.now().date() + timedelta(days=5),
            end_date=timezone.now().date() + timedelta(days=5),
            capacity=5,
            is_active=True,
        )
        trip_plan = TripPlanner.objects.create(
            traveller=traveller,
            title="Removed Item Plan",
            total_days=2,
            travellers_count=1,
            status=TripStatus.PLANNING,
        )
        trip_item = TripPlannerItem.objects.create(
            trip_planner=trip_plan,
            listing=listing,
            day_number=1,
            order=0,
            price_snapshot=listing.price_per_person,
            duration_type_snapshot=listing.duration_type,
            duration_days_snapshot=listing.duration_days,
            duration_nights_snapshot=listing.duration_nights,
            duration_hours_snapshot=listing.average_duration_hours,
        )

        with self.captureOnCommitCallbacks(execute=True):
            listing_service.soft_delete_listing(listing, actor=host_user)

        with self.assertRaises(ServiceError) as exc:
            create_booking_from_trip_plan(
                user=traveller,
                plan_id=trip_plan.pk,
                items_data=[
                    {
                        "trip_plan_item_id": trip_item.pk,
                        "slot_id": slot.pk,
                        "traveller_count": 1,
                    }
                ],
            )

        self.assertEqual(exc.exception.status_code, 404)
        self.assertIn("not found", str(exc.exception.detail).lower())

    def test_host_mark_completed_notification_uses_snapshot_title(self):
        traveller = self.create_account(Account.Role.TRAVELLER)
        host_user, host = self.create_host()
        listing = self.create_listing(host, title="Original Live Listing")
        yesterday = timezone.localdate() - timedelta(days=1)
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.CONFIRMED,
            expires_at=timezone.now(),
            source="direct",
        )
        item = BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=yesterday,
            end_date=yesterday,
            days=1,
            nights=0,
            traveller_count=1,
            status=BookingItemStatus.CONFIRMED,
            snapshot={"title": "Snapshot Completed Listing"},
            price_per_person=listing.price_per_person,
            subtotal=listing.price_per_person,
            quoted_total=listing.price_per_person,
        )

        listing.title = "Renamed Live Listing"
        listing.is_active = False
        listing.is_bookable = False
        listing.save(update_fields=["title", "is_active", "is_bookable"])

        host_mark_completed(host_user, item.pk)

        notification = Notification.objects.get(
            recipient=traveller,
            notification_type=NotificationType.BOOKING_COMPLETED,
        )
        self.assertIn("Snapshot Completed Listing", notification.body)

    def test_host_cannot_mark_future_full_day_item_completed(self):
        traveller = self.create_account(Account.Role.TRAVELLER)
        host_user, host = self.create_host()
        listing = self.create_listing(host, title="Future Listing")
        tomorrow = timezone.localdate() + timedelta(days=1)
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.CONFIRMED,
            expires_at=timezone.now(),
            source="direct",
        )
        item = BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=tomorrow,
            end_date=tomorrow,
            days=1,
            nights=0,
            traveller_count=1,
            status=BookingItemStatus.CONFIRMED,
            snapshot={"title": "Future Listing"},
            price_per_person=listing.price_per_person,
            subtotal=listing.price_per_person,
            quoted_total=listing.price_per_person,
        )

        with self.assertRaises(ServiceError) as exc:
            host_mark_completed(host_user, item.pk)

        self.assertEqual(exc.exception.status_code, 400)
        self.assertEqual(exc.exception.get_codes(), "completion_too_early")

    def test_host_cannot_mark_hourly_item_completed_before_end_time(self):
        traveller = self.create_account(Account.Role.TRAVELLER)
        host_user, host = self.create_host()
        listing = self.create_listing(
            host,
            title="Hourly Listing",
            duration_type=DurationType.HOURLY,
            average_duration_hours=Decimal("2.00"),
        )
        today = timezone.localdate()
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.CONFIRMED,
            expires_at=timezone.now(),
            source="direct",
        )
        item = BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=today,
            end_date=today,
            start_time=time(15, 0),
            end_time=time(17, 0),
            days=1,
            nights=0,
            traveller_count=1,
            status=BookingItemStatus.CONFIRMED,
            snapshot={"title": "Hourly Listing"},
            price_per_person=listing.price_per_person,
            subtotal=listing.price_per_person,
            quoted_total=listing.price_per_person,
        )

        current_tz = timezone.get_current_timezone()
        before_end = timezone.make_aware(datetime.combine(today, time(16, 0)), current_tz)
        with patch("bookings.services.booking_lifecycle_service.timezone.now", return_value=before_end):
            with self.assertRaises(ServiceError) as exc:
                host_mark_completed(host_user, item.pk)

        self.assertEqual(exc.exception.status_code, 400)
        self.assertEqual(exc.exception.get_codes(), "completion_too_early")


# ===========================================================================
# PRICING SERVICE
# ===========================================================================

class BookingPricingTests(TestCase):
    """Unit tests for _calculate_item_price — no DB writes needed."""

    def setUp(self):
        self.listing = ListingFactory(price_per_person=Decimal("1200.00"))

    def test_full_day_single_traveller_pricing(self):
        result = _calculate_item_price(
            self.listing,
            traveller_count=1,
            schedule={"duration_type": DurationType.FULL_DAY, "days": 1},
        )
        expected_subtotal = Decimal("1200.00")
        expected_fee = (expected_subtotal * PLATFORM_FEE_RATE).quantize(Decimal("0.01"))
        expected_tax = (expected_subtotal * VAT_RATE).quantize(Decimal("0.01"))

        self.assertEqual(result["subtotal"], expected_subtotal)
        self.assertEqual(result["fee_amount"], expected_fee)
        self.assertEqual(result["tax_amount"], expected_tax)
        self.assertEqual(
            result["gross_amount"],
            expected_subtotal + expected_fee + expected_tax,
        )

    def test_multi_day_multiplies_by_days(self):
        result = _calculate_item_price(
            self.listing,
            traveller_count=2,
            schedule={"duration_type": DurationType.MULTI_DAY, "days": 3},
        )
        # 1200 × 2 travellers × 3 days = 7200
        self.assertEqual(result["subtotal"], Decimal("7200.00"))

    def test_hourly_does_not_multiply_by_duration(self):
        listing = ListingFactory(
            price_per_person=Decimal("500.00"),
            duration_type=DurationType.HOURLY,
        )
        result = _calculate_item_price(
            listing,
            traveller_count=3,
            schedule={"duration_type": DurationType.HOURLY, "days": 0},
        )
        # 500 × 3 = 1500 (no day multiplier)
        self.assertEqual(result["subtotal"], Decimal("1500.00"))

    def test_fee_and_tax_proportions(self):
        result = _calculate_item_price(
            self.listing,
            traveller_count=1,
            schedule={"duration_type": DurationType.FULL_DAY, "days": 1},
        )
        self.assertEqual(result["fee_amount"], Decimal("60.00"))   # 5% of 1200
        self.assertEqual(result["tax_amount"], Decimal("156.00"))  # 13% of 1200
        self.assertEqual(result["gross_amount"], Decimal("1416.00"))


# ===========================================================================
# SLOT CAPACITY GUARD
# ===========================================================================

class BookingCapacityTests(TestCase):
    """
    Tests for _check_slot_capacity — verifies stale pending items
    don't block new bookings (Bug 1 fix).
    """

    def setUp(self):
        self.listing = ListingFactory()
        self.slot = ActivitySlotFactory(listing=self.listing, capacity=5)

    def test_fresh_booking_under_capacity_is_available(self):
        self.assertTrue(_check_slot_capacity(self.slot, requested_count=3))

    def test_active_confirmed_item_reduces_available_capacity(self):
        booking = BookingFactory.create(confirmed=True)
        BookingItemFactory.create(
            booking=booking, listing=self.listing, slot=self.slot,
            traveller_count=4, status=BookingItemStatus.CONFIRMED,
        )
        # 4 confirmed + 2 requested = 6 > capacity 5
        self.assertFalse(_check_slot_capacity(self.slot, requested_count=2))

    def test_expired_booking_item_does_not_count_against_capacity(self):
        """Stale pending_payment items from an expired booking must not block capacity."""
        expired_booking = BookingFactory.create(
            expired=True,
            expires_at=timezone.now() - timedelta(hours=2),
        )
        BookingItemFactory.create(
            booking=expired_booking,
            listing=self.listing,
            slot=self.slot,
            traveller_count=5,
            status=BookingItemStatus.EXPIRED,
        )
        # All 5 slots should still be available since booking is expired
        self.assertTrue(_check_slot_capacity(self.slot, requested_count=5))

    def test_cancelled_item_does_not_count_against_capacity(self):
        cancelled_booking = BookingFactory.create(cancelled=True)
        BookingItemFactory.create(
            booking=cancelled_booking,
            listing=self.listing,
            slot=self.slot,
            traveller_count=5,
            status=BookingItemStatus.CANCELLED,
        )
        self.assertTrue(_check_slot_capacity(self.slot, requested_count=5))

    def test_exactly_at_capacity_is_not_available(self):
        booking = BookingFactory.create(confirmed=True)
        BookingItemFactory.create(
            booking=booking,
            listing=self.listing,
            slot=self.slot,
            traveller_count=5,
            status=BookingItemStatus.CONFIRMED,
        )
        self.assertFalse(_check_slot_capacity(self.slot, requested_count=1))


# ===========================================================================
# BOOKING CANCELLATION
# ===========================================================================

class BookingCancellationTests(TestCase):

    def test_traveller_can_cancel_own_pending_payment_booking(self):
        traveller = TravellerFactory()
        booking = BookingFactory(traveller=traveller)
        item = BookingItemFactory(booking=booking)

        cancel_booking(traveller, booking.pk, reason="traveller_request")

        booking.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.CANCELLED)
        self.assertEqual(item.status, BookingItemStatus.CANCELLED)

    def test_traveller_cannot_cancel_confirmed_booking(self):
        traveller = TravellerFactory()
        booking = BookingFactory.create(traveller=traveller, confirmed=True)

        with self.assertRaises(ServiceError) as exc:
            cancel_booking(traveller, booking.pk, reason="traveller_request")

        self.assertEqual(exc.exception.status_code, 400)

    def test_other_traveller_cannot_cancel_booking(self):
        owner = TravellerFactory()
        intruder = TravellerFactory()
        booking = BookingFactory(traveller=owner)

        with self.assertRaises(ServiceError) as exc:
            cancel_booking(intruder, booking.pk, reason="traveller_request")

        self.assertEqual(exc.exception.status_code, 404)

    def test_admin_can_cancel_confirmed_booking(self):
        traveller = TravellerFactory()
        booking = BookingFactory.create(traveller=traveller, confirmed=True)
        admin = AccountFactory(role=Account.Role.ADMIN, is_admin=True, is_staff=True)
        BookingItemFactory(
            booking=booking, status=BookingItemStatus.CONFIRMED
        )

        cancel_booking(admin, booking.pk, reason="admin_action")

        booking.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.CANCELLED)

    def test_admin_cannot_cancel_already_cancelled_booking(self):
        traveller = TravellerFactory()
        booking = BookingFactory.create(traveller=traveller, cancelled=True)
        admin = AccountFactory(role=Account.Role.ADMIN, is_admin=True, is_staff=True)

        with self.assertRaises(ServiceError) as exc:
            cancel_booking(admin, booking.pk, reason="admin_action")

        self.assertEqual(exc.exception.status_code, 400)

    def test_cancellation_releases_availability_hold(self):
        traveller = TravellerFactory()
        listing = ListingFactory()
        slot = ActivitySlotFactory(listing=listing, capacity=5)
        booking = BookingFactory(traveller=traveller)
        hold = AvailabilityHoldFactory(
            listing=listing, traveller=traveller, is_released=False
        )
        item = BookingItemFactory(booking=booking, listing=listing, slot=slot)
        item.hold = hold
        item.save(update_fields=["hold"])

        cancel_booking(traveller, booking.pk, reason="traveller_request")

        hold.refresh_from_db()
        self.assertTrue(hold.is_released)


# ===========================================================================
# EXPIRY WORKER
# ===========================================================================

class BookingExpiryWorkerTests(TestCase):

    def test_overdue_pending_booking_is_expired(self):
        traveller = TravellerFactory()
        booking = BookingFactory(
            traveller=traveller,
            expires_at=timezone.now() - timedelta(minutes=30),
        )
        item = BookingItemFactory(booking=booking)

        count = expire_stale_bookings()

        self.assertEqual(count, 1)
        booking.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.EXPIRED)
        self.assertEqual(item.status, BookingItemStatus.EXPIRED)

    def test_fresh_pending_booking_is_not_expired(self):
        traveller = TravellerFactory()
        BookingFactory(
            traveller=traveller,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        count = expire_stale_bookings()

        self.assertEqual(count, 0)

    def test_already_confirmed_booking_is_not_expired(self):
        traveller = TravellerFactory()
        booking = BookingFactory.create(
            traveller=traveller,
            confirmed=True,
            expires_at=timezone.now() - timedelta(hours=1),
        )

        expire_stale_bookings()

        booking.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)

    def test_expiry_releases_hold(self):
        traveller = TravellerFactory()
        listing = ListingFactory()
        slot = ActivitySlotFactory(listing=listing, capacity=5)
        booking = BookingFactory(
            traveller=traveller,
            expires_at=timezone.now() - timedelta(hours=1),
        )
        hold = AvailabilityHoldFactory(
            listing=listing, traveller=traveller, is_released=False
        )
        item = BookingItemFactory(booking=booking, listing=listing, slot=slot)
        item.hold = hold
        item.save(update_fields=["hold"])

        expire_stale_bookings()

        hold.refresh_from_db()
        self.assertTrue(hold.is_released)

    def test_only_expired_bookings_are_counted(self):
        traveller = TravellerFactory()
        # One stale booking
        BookingFactory(
            traveller=traveller,
            expires_at=timezone.now() - timedelta(hours=1),
        )
        # One fresh booking
        BookingFactory(
            traveller=traveller,
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        count = expire_stale_bookings()

        self.assertEqual(count, 1)
