from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Account, HostDetail
from bookings.models import Booking, BookingItem, BookingItemStatus, BookingStatus
from listings.models import (
    ActivityType,
    CancellationPolicy,
    Category,
    DifficultyLevel,
    DurationType,
    Listing,
    ListingSchedule,
)
from notifications.constants import NotificationType
from notifications.models import Notification


class AdminListingNotificationTests(TestCase):
    account_seq = 0

    def setUp(self):
        self.client = APIClient()

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
            business_name="Listing Host Co.",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        return user, host

    def create_listing(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Pokhara City Walk",
            "description": "A curated city walk.",
            "destination": "Pokhara",
            "location": "Lakeside",
            "category": Category.CULTURAL,
            "activity_type": ActivityType.CITY_TOUR,
            "difficulty_level": DifficultyLevel.EASY,
            "ideal_for": ["solo"],
            "price_per_person": "700.00",
            "duration_type": DurationType.FULL_DAY,
            "duration_days": 1,
            "duration_nights": 0,
            "tags": ["walk"],
            "what_to_bring": "Shoes",
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

    def create_booking_item(self, traveller, listing, *, status=BookingItemStatus.PENDING_PAYMENT):
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.PENDING_PAYMENT if status == BookingItemStatus.PENDING_PAYMENT else BookingStatus.CONFIRMED,
            expires_at=timezone.now() + timedelta(minutes=15),
        )
        return BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            days=1,
            nights=0,
            traveller_count=2,
            status=status,
            snapshot={"title": listing.title},
            price_per_person=listing.price_per_person,
            subtotal=listing.price_per_person,
            quoted_total=listing.price_per_person,
        )

    @patch("listings.views.send_ws_notification")
    def test_admin_deactivate_listing_notifies_host_once(self, mocked_send_ws):
        admin = self.create_account(Account.Role.ADMIN)
        host_user, host = self.create_host()
        listing = self.create_listing(host)
        self.client.force_authenticate(user=admin)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"/api/listings/admin/{listing.pk}/deactivate/")

        listing.refresh_from_db()
        notification = Notification.objects.get(
            recipient=host_user,
            notification_type=NotificationType.LISTING_DEACTIVATED,
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(listing.is_active)
        self.assertFalse(listing.is_bookable)
        self.assertEqual(notification.metadata["listing_id"], listing.pk)
        self.assertEqual(mocked_send_ws.call_count, 1)

        with self.captureOnCommitCallbacks(execute=True):
            second_response = self.client.post(f"/api/listings/admin/{listing.pk}/deactivate/")

        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(
            Notification.objects.filter(
                recipient=host_user,
                notification_type=NotificationType.LISTING_DEACTIVATED,
            ).count(),
            1,
        )

    @patch("listings.views.send_ws_notification")
    def test_admin_activate_listing_notifies_host(self, mocked_send_ws):
        admin = self.create_account(Account.Role.ADMIN)
        host_user, host = self.create_host()
        listing = self.create_listing(host, is_active=False, is_bookable=False)
        self.client.force_authenticate(user=admin)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"/api/listings/admin/{listing.pk}/activate/")

        listing.refresh_from_db()
        notification = Notification.objects.get(
            recipient=host_user,
            notification_type=NotificationType.LISTING_ACTIVATED,
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(listing.is_active)
        self.assertFalse(listing.is_bookable)
        self.assertEqual(notification.metadata["listing_id"], listing.pk)
        self.assertEqual(mocked_send_ws.call_count, 1)

    def test_admin_cannot_deactivate_listing_with_active_bookings(self):
        admin = self.create_account(Account.Role.ADMIN)
        traveller = self.create_account(Account.Role.TRAVELLER)
        _, host = self.create_host()
        listing = self.create_listing(host)
        self.create_booking_item(traveller, listing, status=BookingItemStatus.PENDING_PAYMENT)
        self.client.force_authenticate(user=admin)

        response = self.client.post(f"/api/listings/admin/{listing.pk}/deactivate/")

        listing.refresh_from_db()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "listing_has_active_bookings")
        self.assertTrue(listing.is_active)
        self.assertTrue(listing.is_bookable)


class PublicListingVisibilityTests(TestCase):
    account_seq = 0

    def setUp(self):
        self.client = APIClient()

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
            business_name="Visibility Host Co.",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        return user, host

    def create_listing(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Public Visibility Walk",
            "description": "A listing used for public visibility tests.",
            "destination": "Kathmandu",
            "location": "Thamel",
            "category": Category.CULTURAL,
            "activity_type": ActivityType.CITY_TOUR,
            "difficulty_level": DifficultyLevel.EASY,
            "ideal_for": ["solo"],
            "price_per_person": "999.00",
            "duration_type": DurationType.FULL_DAY,
            "duration_days": 1,
            "duration_nights": 0,
            "tags": ["walk"],
            "what_to_bring": "Shoes",
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

    def test_public_listing_endpoints_hide_blocked_host_content(self):
        _, active_host = self.create_host()
        blocked_user, blocked_host = self.create_host()
        visible_listing = self.create_listing(active_host, title="Visible Listing")
        hidden_listing = self.create_listing(blocked_host, title="Hidden Listing")

        blocked_user.is_active = False
        blocked_user.save(update_fields=["is_active"])

        list_response = self.client.get(reverse("listings:listing-list"))
        self.assertEqual(list_response.status_code, 200)
        payload = list_response.json()
        results = payload["results"] if "results" in payload else payload
        listed_ids = {item["id"] for item in results}

        self.assertIn(visible_listing.pk, listed_ids)
        self.assertNotIn(hidden_listing.pk, listed_ids)

        detail_response = self.client.get(
            reverse("listings:listing-detail", kwargs={"pk": hidden_listing.pk})
        )
        self.assertEqual(detail_response.status_code, 404)

        slug_response = self.client.get(
            reverse("listings:listing-by-slug", kwargs={"slug": hidden_listing.slug})
        )
        self.assertEqual(slug_response.status_code, 404)


class HostListingDeleteGuardTests(TestCase):
    account_seq = 0

    def setUp(self):
        self.client = APIClient()

    def create_account(self, role, **overrides):
        self.__class__.account_seq += 1
        seq = self.__class__.account_seq
        defaults = {
            "email": f"{role}-delete-guard-{seq}@example.com",
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
            business_name="Delete Guard Host Co.",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        return user, host

    def create_listing(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Delete Guard Listing",
            "description": "A listing used for delete guard tests.",
            "destination": "Pokhara",
            "location": "Lakeside",
            "category": Category.CULTURAL,
            "activity_type": ActivityType.CITY_TOUR,
            "difficulty_level": DifficultyLevel.EASY,
            "ideal_for": ["solo"],
            "price_per_person": "700.00",
            "duration_type": DurationType.FULL_DAY,
            "duration_days": 1,
            "duration_nights": 0,
            "tags": ["walk"],
            "what_to_bring": "Shoes",
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

    def create_booking_item(self, traveller, listing, *, status):
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.PENDING_PAYMENT if status == BookingItemStatus.PENDING_PAYMENT else BookingStatus.CONFIRMED,
            expires_at=timezone.now() + timedelta(minutes=15),
        )
        return BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            days=1,
            nights=0,
            traveller_count=2,
            status=status,
            snapshot={"title": listing.title},
            price_per_person=listing.price_per_person,
            subtotal=listing.price_per_person,
            quoted_total=listing.price_per_person,
        )

    def test_host_cannot_delete_listing_with_pending_payment_booking(self):
        host_user, host = self.create_host()
        traveller = self.create_account(Account.Role.TRAVELLER)
        listing = self.create_listing(host)
        self.create_booking_item(traveller, listing, status=BookingItemStatus.PENDING_PAYMENT)
        self.client.force_authenticate(user=host_user)

        response = self.client.delete(
            reverse("listings:host-listing-delete", kwargs={"pk": listing.pk})
        )

        listing.refresh_from_db()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "listing_has_active_bookings")
        self.assertTrue(listing.is_active)
        self.assertTrue(listing.is_bookable)

    def test_host_can_delete_listing_when_only_completed_bookings_exist(self):
        host_user, host = self.create_host()
        traveller = self.create_account(Account.Role.TRAVELLER)
        listing = self.create_listing(host)
        self.create_booking_item(traveller, listing, status=BookingItemStatus.COMPLETED)
        self.client.force_authenticate(user=host_user)

        response = self.client.delete(
            reverse("listings:host-listing-delete", kwargs={"pk": listing.pk})
        )

        listing.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertFalse(listing.is_active)
        self.assertFalse(listing.is_bookable)


class ListingSignalAndValidationTests(TestCase):
    account_seq = 0

    def setUp(self):
        self.client = APIClient()

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
            business_name="Signal Host Co.",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        return user, host

    def create_listing(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Signal Listing",
            "description": "A listing used for signal and validation tests.",
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
            "tags": ["walk"],
            "what_to_bring": "Shoes",
            "requirements": "None",
            "inclusions": ["Guide"],
            "exclusions": ["Meals"],
            "cancellation_policy": CancellationPolicy.MODERATE,
            "languages_offered": ["english"],
            "best_seasons": ["autumn"],
            "is_active": True,
            "is_bookable": False,
        }
        defaults.update(overrides)
        return Listing.objects.create(**defaults)

    @patch("recommendations.tasks.reindex_listing_task.delay")
    @patch("listings.tasks.generate_slots_for_listing_task.delay")
    def test_publish_signal_defers_tasks_until_commit(
        self,
        mocked_generate_delay,
        mocked_reindex_delay,
    ):
        _, host = self.create_host()
        listing = self.create_listing(host)

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            listing.is_bookable = True
            listing.save(update_fields=["is_bookable"])
            mocked_generate_delay.assert_not_called()
            mocked_reindex_delay.assert_not_called()

        self.assertEqual(len(callbacks), 2)
        for callback in callbacks:
            callback()

        mocked_generate_delay.assert_called_once_with(listing.pk)
        mocked_reindex_delay.assert_called_once_with(listing.pk)

    @patch("listings.tasks.regenerate_slots_for_listing_task.delay")
    def test_schedule_save_defers_regeneration_until_commit(self, mocked_delay):
        _, host = self.create_host()
        listing = self.create_listing(host, is_bookable=True)

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            ListingSchedule.objects.create(
                listing=listing,
                days_of_week=[0, 2, 4],
                time_slots=[],
                capacity=10,
                advance_days=30,
                is_active=True,
            )
            mocked_delay.assert_not_called()

        self.assertEqual(len(callbacks), 1)
        callbacks[0]()
        mocked_delay.assert_called_once_with(listing.pk)

    def test_image_upload_returns_400_for_invalid_order(self):
        host_user, host = self.create_host()
        listing = self.create_listing(host, is_bookable=True)
        self.client.force_authenticate(user=host_user)
        image = SimpleUploadedFile(
            "tiny.gif",
            (
                b"GIF87a\x01\x00\x01\x00\x80\x00\x00"
                b"\x00\x00\x00\xff\xff\xff!\xf9\x04\x01"
                b"\x00\x00\x00\x00,\x00\x00\x00\x00\x01"
                b"\x00\x01\x00\x00\x02\x02D\x01\x00;"
            ),
            content_type="image/gif",
        )

        response = self.client.post(
            reverse("listings:host-listing-image-upload", kwargs={"pk": listing.pk}),
            {
                "image": image,
                "order": "abc",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("order", response.json())


# ===========================================================================
# HOST LISTING CREATION
# ===========================================================================

class HostListingCreationTests(TestCase):
    """
    Tests for the host listing creation endpoint.
    Covers role enforcement, verified vs. unverified host limits, and required fields.
    """

    def setUp(self):
        self.client = APIClient()

    def _listing_payload(self, **overrides):
        data = {
            "title": "Pokhara Sunrise Hike",
            "description": "Early morning hike with stunning views of the Himalayas and Pokhara valley.",
            "destination": "Pokhara",
            "location": "Sarangkot",
            "category": "adventure",
            "activity_type": "hiking",
            "difficulty_level": "easy",
            "ideal_for": ["solo"],
            "price_per_person": "1500.00",
            "duration_type": "full_day",
            "duration_days": 1,
            "duration_nights": 0,
            "tags": ["hiking"],
            "what_to_bring": "Warm jacket",
            "requirements": "None",
            "inclusions": ["Guide"],
            "exclusions": ["Meals"],
            "cancellation_policy": "moderate",
            "languages_offered": ["english"],
            "best_seasons": ["autumn"],
            "max_group_size": 8,
            "min_group_size": 1,
        }
        data.update(overrides)
        return data

    def test_verified_host_can_create_listing(self):
        from tests.factories import HostDetailFactory
        host_user, _ = HostDetailFactory.create_with_user()
        self.client.force_authenticate(user=host_user)

        response = self.client.post(
            reverse("listings:host-listing-create"),
            self._listing_payload(),
            format="json",
        )
        self.assertEqual(response.status_code, 201)

    def test_traveller_cannot_create_listing(self):
        from tests.factories import TravellerFactory
        traveller = TravellerFactory()
        self.client.force_authenticate(user=traveller)

        response = self.client.post(
            reverse("listings:host-listing-create"),
            self._listing_payload(),
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_unauthenticated_cannot_create_listing(self):
        response = self.client.post(
            reverse("listings:host-listing-create"),
            self._listing_payload(),
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_missing_required_field_returns_400(self):
        from tests.factories import HostDetailFactory
        host_user, _ = HostDetailFactory.create_with_user()
        self.client.force_authenticate(user=host_user)
        payload = self._listing_payload()
        del payload["title"]

        response = self.client.post(
            reverse("listings:host-listing-create"),
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, 400)


# ===========================================================================
# HOST SLOT MANAGEMENT
# ===========================================================================

class HostSlotManagementTests(TestCase):
    """
    Tests for the host slot create / update / delete API.
    Covers permission enforcement and basic CRUD.
    """

    def setUp(self):
        self.client = APIClient()
        from tests.factories import HostDetailFactory, ListingFactory
        self.host_user, self.host = HostDetailFactory.create_with_user()
        self.listing = ListingFactory(host=self.host)
        self.client.force_authenticate(user=self.host_user)

    def _slot_url(self, slot_id=None):
        if slot_id:
            return reverse(
                "listings:host-listing-slot-detail",
                kwargs={"pk": self.listing.pk, "slot_id": slot_id},
            )
        return reverse("listings:host-listing-slots", kwargs={"pk": self.listing.pk})

    def test_host_can_create_slot(self):
        from datetime import date, timedelta
        future = date.today() + timedelta(days=10)
        response = self.client.post(
            self._slot_url(),
            {
                "start_date": str(future),
                "end_date": str(future),
                "capacity": 8,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

    def test_host_can_update_slot_capacity(self):
        from listings.models import ActivitySlot
        from datetime import date, timedelta
        future = date.today() + timedelta(days=14)
        slot = ActivitySlot.objects.create(
            listing=self.listing,
            start_date=future,
            end_date=future,
            capacity=5,
            is_active=True,
        )

        response = self.client.patch(
            self._slot_url(slot.pk),
            {"capacity": 10},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        slot.refresh_from_db()
        self.assertEqual(slot.capacity, 10)

    def test_host_can_delete_slot(self):
        from listings.models import ActivitySlot
        from datetime import date, timedelta
        future = date.today() + timedelta(days=21)
        slot = ActivitySlot.objects.create(
            listing=self.listing,
            start_date=future,
            end_date=future,
            capacity=5,
            is_active=True,
        )

        response = self.client.delete(self._slot_url(slot.pk))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(ActivitySlot.objects.filter(pk=slot.pk).exists())

    def test_other_host_cannot_manage_listing_slots(self):
        from tests.factories import HostDetailFactory
        other_host_user, _ = HostDetailFactory.create_with_user()
        self.client.force_authenticate(user=other_host_user)

        response = self.client.get(self._slot_url())
        self.assertEqual(response.status_code, 403)
