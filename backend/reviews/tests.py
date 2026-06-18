from unittest.mock import patch

from django.core import mail
from django.db import IntegrityError
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
)
from notifications.constants import NotificationType
from notifications.models import Notification
from packages.models import Package, PackageListing
from reviews.emails import send_host_review_notification_mail
from reviews.models import HostReplyStatus, Review, ReviewReport, ReviewStatus
from reviews.serializers import ReviewListSerializer
from reviews.services.reviews_service import (
    create_review,
    moderate_review,
    report_host_reply,
    report_review,
)
from utils.exceptions import ServiceError


class ReviewNotificationTests(TestCase):
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

    def create_host(self, **overrides):
        user = overrides.pop("user", None) or self.create_account(Account.Role.HOST)
        defaults = {
            "user": user,
            "business_name": "Wild Trails",
            "verification_status": HostDetail.VerificationStatus.APPROVED,
        }
        defaults.update(overrides)
        return HostDetail.objects.create(**defaults)

    def create_listing(self, host):
        return Listing.objects.create(
            host=host,
            title="Chitwan Safari",
            description="Guided safari tour",
            destination="Chitwan",
            location="Sauraha",
            category=Category.NATURE,
            activity_type=ActivityType.WILDLIFE_SAFARI,
            difficulty_level=DifficultyLevel.EASY,
            ideal_for=["couples"],
            price_per_person="1800.00",
            duration_type=DurationType.FULL_DAY,
            duration_days=1,
            duration_nights=0,
            tags=["wildlife"],
            what_to_bring="Hat",
            requirements="None",
            inclusions=["Guide"],
            exclusions=["Personal expenses"],
            cancellation_policy=CancellationPolicy.MODERATE,
            languages_offered=["english"],
            best_seasons=["autumn"],
            rating_average="4.50",
            rating_count=3,
            is_active=True,
            is_bookable=True,
        )

    def create_review(self, **overrides):
        host = overrides.pop("host", None) or self.create_host()
        traveller = overrides.pop(
            "traveller", None,
        ) or self.create_account(Account.Role.TRAVELLER)
        listing = overrides.pop("listing", None) or self.create_listing(host)
        defaults = {
            "traveller": traveller,
            "listing": listing,
            "rating": 4,
            "comment": "Nice trip",
            "status": ReviewStatus.PUBLISHED,
        }
        defaults.update(overrides)
        return Review.objects.create(**defaults)

    @patch("reviews.services.reviews_service.send_ws_notification")
    def test_report_review_notifies_admins(self, mocked_send_ws):
        host_user = self.create_account(Account.Role.HOST)
        host = self.create_host(user=host_user)
        admin_one = self.create_account(Account.Role.ADMIN)
        admin_two = self.create_account(Account.Role.ADMIN)
        review = self.create_review(host=host)

        with self.captureOnCommitCallbacks(execute=True):
            report = report_review(
                review=review,
                reporter=host_user,
                reason=ReviewReport.Reason.SPAM,
                details="Looks suspicious",
            )

        notifications = Notification.objects.filter(
            notification_type=NotificationType.REVIEW_REPORTED,
        ).order_by("recipient_id")

        self.assertEqual(notifications.count(), 2)
        self.assertEqual(
            {notification.recipient_id for notification in notifications},
            {admin_one.pk, admin_two.pk},
        )
        self.assertEqual(notifications[0].metadata["report_id"], report.pk)
        self.assertEqual(
            notifications[0].metadata["target_type"],
            ReviewReport.TargetType.REVIEW,
        )
        self.assertEqual(mocked_send_ws.call_count, 2)

    @patch("reviews.services.reviews_service.send_ws_notification")
    def test_report_host_reply_notifies_admins(self, mocked_send_ws):
        admin = self.create_account(Account.Role.ADMIN)
        traveller = self.create_account(Account.Role.TRAVELLER)
        host = self.create_host()
        review = self.create_review(
            host=host,
            traveller=traveller,
            host_reply="Thanks for visiting",
            host_reply_status=HostReplyStatus.PUBLISHED,
        )

        with self.captureOnCommitCallbacks(execute=True):
            report = report_host_reply(
                review=review,
                reporter=traveller,
                reason=ReviewReport.Reason.ABUSIVE_LANGUAGE,
                details="Reply is abusive",
            )

        notification = Notification.objects.get(
            recipient=admin,
            notification_type=NotificationType.REVIEW_REPORTED,
        )

        self.assertEqual(notification.metadata["report_id"], report.pk)
        self.assertEqual(
            notification.metadata["target_type"],
            ReviewReport.TargetType.HOST_REPLY,
        )
        self.assertIn("host reply", notification.body.lower())
        self.assertEqual(mocked_send_ws.call_count, 1)

    @patch("reviews.services.reviews_service.ReviewReport.objects.create")
    def test_report_review_translates_integrity_error(self, mock_create):
        host_user = self.create_account(Account.Role.HOST)
        host = self.create_host(user=host_user)
        review = self.create_review(host=host)
        mock_create.side_effect = IntegrityError("duplicate key value violates unique constraint")

        with self.assertRaises(ServiceError) as exc:
            report_review(
                review=review,
                reporter=host_user,
                reason=ReviewReport.Reason.SPAM,
                details="Looks suspicious",
            )

        self.assertEqual(exc.exception.status_code, 400)
        self.assertEqual(exc.exception.get_codes(), "duplicate_report")

    @patch("reviews.services.reviews_service.ReviewReport.objects.create")
    def test_report_host_reply_translates_integrity_error(self, mock_create):
        traveller = self.create_account(Account.Role.TRAVELLER)
        host = self.create_host()
        review = self.create_review(
            host=host,
            traveller=traveller,
            host_reply="Thanks for visiting",
            host_reply_status=HostReplyStatus.PUBLISHED,
        )
        mock_create.side_effect = IntegrityError("duplicate key value violates unique constraint")

        with self.assertRaises(ServiceError) as exc:
            report_host_reply(
                review=review,
                reporter=traveller,
                reason=ReviewReport.Reason.ABUSIVE_LANGUAGE,
                details="Reply is abusive",
            )

        self.assertEqual(exc.exception.status_code, 400)
        self.assertEqual(exc.exception.get_codes(), "duplicate_report")

    @patch("reviews.services.reviews_service.send_ws_notification")
    def test_moderate_review_notifies_traveller(self, mocked_send_ws):
        admin = self.create_account(Account.Role.ADMIN)
        review = self.create_review()

        with self.captureOnCommitCallbacks(execute=True):
            moderate_review(
                review=review,
                action="mark_removed",
                admin_user=admin,
                note="Violates review policy",
            )

        review.refresh_from_db()
        notification = Notification.objects.get(
            recipient=review.traveller,
            notification_type=NotificationType.REVIEW_MODERATED,
        )

        self.assertEqual(review.status, ReviewStatus.REMOVED)
        self.assertEqual(notification.title, "Review Removed")
        self.assertEqual(notification.metadata["review_id"], review.pk)
        self.assertEqual(notification.metadata["old_status"], ReviewStatus.PUBLISHED)
        self.assertEqual(notification.metadata["new_status"], ReviewStatus.REMOVED)
        self.assertEqual(mocked_send_ws.call_count, 1)

    def test_host_review_list_serializer_uses_booking_snapshot_title(self):
        host_user = self.create_account(Account.Role.HOST)
        host = self.create_host(user=host_user)
        traveller = self.create_account(Account.Role.TRAVELLER)
        listing = self.create_listing(host)
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.CONFIRMED,
            expires_at=timezone.now(),
        )
        booking_item = BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            days=1,
            nights=0,
            traveller_count=1,
            status=BookingItemStatus.COMPLETED,
            snapshot={"title": "Snapshot Review Listing"},
            price_per_person=listing.price_per_person,
            subtotal=listing.price_per_person,
            quoted_total=listing.price_per_person,
            completed_at=timezone.now(),
        )
        review = Review.objects.create(
            traveller=traveller,
            listing=listing,
            booking_item=booking_item,
            rating=4,
            comment="Good trip",
            status=ReviewStatus.PUBLISHED,
        )

        listing.title = "Live Review Listing"
        listing.is_active = False
        listing.is_bookable = False
        listing.save(update_fields=["title", "is_active", "is_bookable"])

        data = ReviewListSerializer(review).data
        self.assertEqual(data["listing_title"], "Snapshot Review Listing")

    def test_review_read_serializer_exposes_listing_title_for_traveller_views(self):
        host_user = self.create_account(Account.Role.HOST)
        host = self.create_host(user=host_user)
        traveller = self.create_account(Account.Role.TRAVELLER)
        listing = self.create_listing(host)
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.CONFIRMED,
            expires_at=timezone.now(),
        )
        booking_item = BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            days=1,
            nights=0,
            traveller_count=1,
            status=BookingItemStatus.COMPLETED,
            snapshot={"title": "Snapshot Traveller Listing"},
            price_per_person=listing.price_per_person,
            subtotal=listing.price_per_person,
            quoted_total=listing.price_per_person,
            completed_at=timezone.now(),
        )
        review = Review.objects.create(
            traveller=traveller,
            listing=listing,
            booking_item=booking_item,
            rating=4,
            comment="Good trip",
            status=ReviewStatus.PUBLISHED,
        )

        listing.title = "Live Traveller Listing"
        listing.save(update_fields=["title"])

        client = APIClient()
        client.force_authenticate(user=traveller)
        response = client.get(reverse("reviews:review-list-create"))

        self.assertEqual(response.status_code, 200)
        data = response.json()["results"][0]
        self.assertEqual(data["listing_id"], listing.pk)
        self.assertEqual(data["listing_title"], "Snapshot Traveller Listing")
        self.assertIsNone(data["package_title"])

    def test_create_review_notification_uses_booking_snapshot_title(self):
        host_user = self.create_account(Account.Role.HOST)
        host = self.create_host(user=host_user)
        traveller = self.create_account(Account.Role.TRAVELLER)
        listing = self.create_listing(host)
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.CONFIRMED,
            expires_at=timezone.now(),
        )
        booking_item = BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            days=1,
            nights=0,
            traveller_count=1,
            status=BookingItemStatus.COMPLETED,
            snapshot={"title": "Snapshot Notification Listing"},
            price_per_person=listing.price_per_person,
            subtotal=listing.price_per_person,
            quoted_total=listing.price_per_person,
            completed_at=timezone.now(),
        )

        listing.title = "Live Review Notification Listing"
        listing.is_active = False
        listing.is_bookable = False
        listing.save(update_fields=["title", "is_active", "is_bookable"])

        create_review(
            traveller,
            {
                "booking_item": booking_item,
                "listing": listing,
                "package": None,
                "rating": 5,
                "comment": "Amazing trip",
                "completion_date_snapshot": booking_item.completed_at,
            },
        )

        notification = Notification.objects.get(
            recipient=host_user,
            notification_type=NotificationType.REVIEW_RECEIVED,
        )
        self.assertIn("Snapshot Notification Listing", notification.body)

    def test_review_email_uses_booking_snapshot_title(self):
        host_user = self.create_account(Account.Role.HOST)
        host = self.create_host(user=host_user)
        traveller = self.create_account(Account.Role.TRAVELLER)
        listing = self.create_listing(host)
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.CONFIRMED,
            expires_at=timezone.now(),
        )
        booking_item = BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            days=1,
            nights=0,
            traveller_count=1,
            status=BookingItemStatus.COMPLETED,
            snapshot={"title": "Snapshot Email Listing"},
            price_per_person=listing.price_per_person,
            subtotal=listing.price_per_person,
            quoted_total=listing.price_per_person,
            completed_at=timezone.now(),
        )
        review = Review.objects.create(
            traveller=traveller,
            listing=listing,
            booking_item=booking_item,
            rating=4,
            comment="Great trip",
            status=ReviewStatus.PUBLISHED,
        )

        listing.title = "Live Review Email Listing"
        listing.is_active = False
        listing.is_bookable = False
        listing.save(update_fields=["title", "is_active", "is_bookable"])

        send_host_review_notification_mail(review, host_user)

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Snapshot Email Listing", mail.outbox[0].subject)


class PublicReviewPaginationTests(TestCase):
    """
    Tests for the public review list endpoints:
      GET /api/listings/{listing_pk}/reviews/
      GET /api/packages/{package_pk}/reviews/

    Verifies page_size support, newest-first ordering, published-only filtering,
    and correct count/next/previous/results shape.
    """

    account_seq = 0

    def setUp(self):
        self.client = APIClient()
        self.host_user = self._create_account(Account.Role.HOST)
        self.host = HostDetail.objects.create(
            user=self.host_user,
            business_name="Summit Treks",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        self.listing = Listing.objects.create(
            host=self.host,
            title="Everest Base Camp Trek",
            description="Classic EBC route",
            destination="Solukhumbu",
            location="Lukla",
            category=Category.NATURE,
            activity_type=ActivityType.WILDLIFE_SAFARI,
            difficulty_level=DifficultyLevel.EASY,
            ideal_for=["solo"],
            price_per_person="5000.00",
            duration_type=DurationType.FULL_DAY,
            duration_days=1,
            duration_nights=0,
            tags=[],
            what_to_bring="Warm clothes",
            requirements="Fitness",
            inclusions=["Guide"],
            exclusions=[],
            cancellation_policy=CancellationPolicy.MODERATE,
            languages_offered=["english"],
            best_seasons=["autumn"],
            is_active=True,
            is_bookable=True,
        )
        self.package = Package.objects.create(
            host=self.host,
            title="Nepal Grand Tour",
            slug="nepal-grand-tour",
            description="Full Nepal experience",
            duration_days=10,
            duration_nights=9,
            total_price="15000.00",
            max_group_size=12,
            is_active=True,
            is_bookable=True,
        )
        self.package_listing_one = Listing.objects.create(
            host=self.host,
            title="Package Day One",
            description="First included listing",
            destination="Pokhara",
            location="Lakeside",
            category=Category.CULTURAL,
            activity_type=ActivityType.CITY_TOUR,
            difficulty_level=DifficultyLevel.EASY,
            ideal_for=["solo"],
            price_per_person="2500.00",
            duration_type=DurationType.FULL_DAY,
            duration_days=1,
            duration_nights=0,
            tags=[],
            what_to_bring="Water",
            requirements="None",
            inclusions=["Guide"],
            exclusions=[],
            cancellation_policy=CancellationPolicy.MODERATE,
            languages_offered=["english"],
            best_seasons=["autumn"],
            is_active=True,
            is_bookable=True,
        )
        self.package_listing_two = Listing.objects.create(
            host=self.host,
            title="Package Day Two",
            description="Second included listing",
            destination="Chitwan",
            location="Sauraha",
            category=Category.NATURE,
            activity_type=ActivityType.WILDLIFE_SAFARI,
            difficulty_level=DifficultyLevel.EASY,
            ideal_for=["solo"],
            price_per_person="3000.00",
            duration_type=DurationType.FULL_DAY,
            duration_days=1,
            duration_nights=0,
            tags=[],
            what_to_bring="Camera",
            requirements="None",
            inclusions=["Guide"],
            exclusions=[],
            cancellation_policy=CancellationPolicy.MODERATE,
            languages_offered=["english"],
            best_seasons=["autumn"],
            is_active=True,
            is_bookable=True,
        )
        PackageListing.objects.create(
            package=self.package,
            listing=self.package_listing_one,
            sort_order=0,
        )
        PackageListing.objects.create(
            package=self.package,
            listing=self.package_listing_two,
            sort_order=1,
        )

    def _create_account(self, role):
        self.__class__.account_seq += 1
        seq = self.__class__.account_seq
        return Account.objects.create(
            email=f"{role}-{seq}@example.com",
            role=role,
            first_name="Test",
            last_name="User",
            is_active=True,
        )

    def _make_listing_review(self, status=ReviewStatus.PUBLISHED, rating=4, comment="Good"):
        traveller = self._create_account(Account.Role.TRAVELLER)
        return Review.objects.create(
            traveller=traveller,
            listing=self.listing,
            rating=rating,
            comment=comment,
            status=status,
        )

    def _make_package_review(self, status=ReviewStatus.PUBLISHED, rating=4, comment="Good"):
        traveller = self._create_account(Account.Role.TRAVELLER)
        return Review.objects.create(
            traveller=traveller,
            package=self.package,
            rating=rating,
            comment=comment,
            status=status,
        )

    # ── Listing review tests ──────────────────────────────────────────────────

    def test_listing_reviews_page1_page_size3(self):
        """Page 1 with page_size=3 returns 3 results and correct pagination fields."""
        for i in range(5):
            self._make_listing_review(comment=f"Review {i}")

        url = reverse("listings:listing-reviews", kwargs={"listing_pk": self.listing.pk})
        response = self.client.get(url, {"page": 1, "page_size": 3})

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 5)
        self.assertEqual(len(data["results"]), 3)
        self.assertIsNone(data["previous"])
        self.assertIsNotNone(data["next"])

    def test_listing_reviews_page2_page_size3(self):
        """Page 2 with page_size=3 returns remaining 2 results and no next link."""
        for i in range(5):
            self._make_listing_review(comment=f"Review {i}")

        url = reverse("listings:listing-reviews", kwargs={"listing_pk": self.listing.pk})
        response = self.client.get(url, {"page": 2, "page_size": 3})

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 5)
        self.assertEqual(len(data["results"]), 2)
        self.assertIsNone(data["next"])
        self.assertIsNotNone(data["previous"])

    def test_listing_reviews_newest_first(self):
        """Results are ordered newest first (-created_at)."""
        r1 = self._make_listing_review(comment="Oldest")
        r2 = self._make_listing_review(comment="Middle")
        r3 = self._make_listing_review(comment="Newest")

        url = reverse("listings:listing-reviews", kwargs={"listing_pk": self.listing.pk})
        response = self.client.get(url, {"page_size": 10})

        self.assertEqual(response.status_code, 200)
        ids = [r["id"] for r in response.json()["results"]]
        self.assertEqual(ids, [r3.pk, r2.pk, r1.pk])

    def test_listing_reviews_only_published(self):
        """Non-published reviews are excluded from public listing."""
        self._make_listing_review(status=ReviewStatus.PUBLISHED)
        self._make_listing_review(status=ReviewStatus.PUBLISHED)
        self._make_listing_review(status=ReviewStatus.UNDER_REVIEW)
        self._make_listing_review(status=ReviewStatus.REMOVED)

        url = reverse("listings:listing-reviews", kwargs={"listing_pk": self.listing.pk})
        response = self.client.get(url, {"page_size": 10})

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 2)
        self.assertEqual(len(data["results"]), 2)

    def test_listing_reviews_no_more_returns_null_next(self):
        """When all reviews fit on one page, next is null."""
        self._make_listing_review()
        self._make_listing_review()

        url = reverse("listings:listing-reviews", kwargs={"listing_pk": self.listing.pk})
        response = self.client.get(url, {"page_size": 10})

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["next"])

    def test_listing_reviews_hide_soft_deleted_listing(self):
        self._make_listing_review()
        self.listing.is_active = False
        self.listing.is_bookable = False
        self.listing.save(update_fields=["is_active", "is_bookable"])

        url = reverse("listings:listing-reviews", kwargs={"listing_pk": self.listing.pk})
        response = self.client.get(url, {"page_size": 10})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 0)

    # ── Package review tests ──────────────────────────────────────────────────

    def test_package_reviews_page1_page_size3(self):
        """Page 1 with page_size=3 returns 3 results and correct pagination fields."""
        for i in range(5):
            self._make_package_review(comment=f"Review {i}")

        url = reverse("packages:package-reviews", kwargs={"package_pk": self.package.pk})
        response = self.client.get(url, {"page": 1, "page_size": 3})

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 5)
        self.assertEqual(len(data["results"]), 3)
        self.assertIsNone(data["previous"])
        self.assertIsNotNone(data["next"])

    def test_package_reviews_page2_page_size3(self):
        """Page 2 with page_size=3 returns remaining 2 results and no next link."""
        for i in range(5):
            self._make_package_review(comment=f"Review {i}")

        url = reverse("packages:package-reviews", kwargs={"package_pk": self.package.pk})
        response = self.client.get(url, {"page": 2, "page_size": 3})

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 5)
        self.assertEqual(len(data["results"]), 2)
        self.assertIsNone(data["next"])
        self.assertIsNotNone(data["previous"])

    def test_package_reviews_newest_first(self):
        """Results are ordered newest first (-created_at)."""
        r1 = self._make_package_review(comment="Oldest")
        r2 = self._make_package_review(comment="Middle")
        r3 = self._make_package_review(comment="Newest")

        url = reverse("packages:package-reviews", kwargs={"package_pk": self.package.pk})
        response = self.client.get(url, {"page_size": 10})

        self.assertEqual(response.status_code, 200)
        ids = [r["id"] for r in response.json()["results"]]
        self.assertEqual(ids, [r3.pk, r2.pk, r1.pk])

    def test_package_reviews_only_published(self):
        """Non-published reviews are excluded from public package listing."""
        self._make_package_review(status=ReviewStatus.PUBLISHED)
        self._make_package_review(status=ReviewStatus.PUBLISHED)
        self._make_package_review(status=ReviewStatus.UNDER_REVIEW)
        self._make_package_review(status=ReviewStatus.REMOVED)

        url = reverse("packages:package-reviews", kwargs={"package_pk": self.package.pk})
        response = self.client.get(url, {"page_size": 10})

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 2)
        self.assertEqual(len(data["results"]), 2)

    def test_package_reviews_no_more_returns_null_next(self):
        """When all reviews fit on one page, next is null."""
        self._make_package_review()
        self._make_package_review()

        url = reverse("packages:package-reviews", kwargs={"package_pk": self.package.pk})
        response = self.client.get(url, {"page_size": 10})

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["next"])

    def test_package_reviews_hide_package_that_is_no_longer_public(self):
        self._make_package_review()
        self.package_listing_two.is_active = False
        self.package_listing_two.is_bookable = False
        self.package_listing_two.save(update_fields=["is_active", "is_bookable"])

        url = reverse("packages:package-reviews", kwargs={"package_pk": self.package.pk})
        response = self.client.get(url, {"page_size": 10})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 0)


class ReviewRecreatePreservesHistoryTests(TestCase):
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

    def create_host(self, **overrides):
        user = overrides.pop("user", None) or self.create_account(Account.Role.HOST)
        defaults = {
            "user": user,
            "business_name": "History Host",
            "verification_status": HostDetail.VerificationStatus.APPROVED,
        }
        defaults.update(overrides)
        return HostDetail.objects.create(**defaults)

    def create_listing(self, host):
        return Listing.objects.create(
            host=host,
            title="History Listing",
            description="Guided tour used in review recreation tests.",
            destination="Chitwan",
            location="Sauraha",
            category=Category.NATURE,
            activity_type=ActivityType.WILDLIFE_SAFARI,
            difficulty_level=DifficultyLevel.EASY,
            ideal_for=["couples"],
            price_per_person="1800.00",
            duration_type=DurationType.FULL_DAY,
            duration_days=1,
            duration_nights=0,
            tags=["wildlife"],
            what_to_bring="Hat",
            requirements="None",
            inclusions=["Guide"],
            exclusions=["Personal expenses"],
            cancellation_policy=CancellationPolicy.MODERATE,
            languages_offered=["english"],
            best_seasons=["autumn"],
            is_active=True,
            is_bookable=True,
        )

    def test_recreate_after_user_delete_preserves_old_review_row(self):
        host_user = self.create_account(Account.Role.HOST)
        host = self.create_host(user=host_user)
        traveller = self.create_account(Account.Role.TRAVELLER)
        listing = self.create_listing(host)
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.CONFIRMED,
            expires_at=timezone.now(),
        )
        booking_item = BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            days=1,
            nights=0,
            traveller_count=1,
            status=BookingItemStatus.COMPLETED,
            snapshot={"title": "Archived Review Listing"},
            price_per_person=listing.price_per_person,
            subtotal=listing.price_per_person,
            quoted_total=listing.price_per_person,
            completed_at=timezone.now(),
        )
        old_review = Review.objects.create(
            traveller=traveller,
            listing=listing,
            booking_item=booking_item,
            rating=2,
            comment="Original deleted review",
            status=ReviewStatus.USER_DELETED,
            deleted_at=timezone.now(),
            deleted_by_user=True,
        )
        report = ReviewReport.objects.create(
            review=old_review,
            reporter=host_user,
            target_type=ReviewReport.TargetType.REVIEW,
            reason=ReviewReport.Reason.SPAM,
            details="Old content report",
        )

        new_review = create_review(
            traveller,
            {
                "booking_item": booking_item,
                "listing": listing,
                "package": None,
                "rating": 5,
                "comment": "Replacement review",
                "completion_date_snapshot": booking_item.completed_at,
            },
        )

        old_review.refresh_from_db()
        report.refresh_from_db()
        booking_item.refresh_from_db()

        self.assertEqual(Review.objects.count(), 2)
        self.assertIsNone(old_review.booking_item)
        self.assertEqual(old_review.status, ReviewStatus.USER_DELETED)
        self.assertEqual(report.review_id, old_review.pk)
        self.assertEqual(booking_item.review.pk, new_review.pk)
        self.assertNotEqual(new_review.pk, old_review.pk)


# ===========================================================================
# REVIEW ELIGIBILITY
# ===========================================================================

class ReviewEligibilityTests(TestCase):
    """
    Tests for `create_review` service — guards and duplicate prevention.
    """

    account_seq = 0

    def setUp(self):
        self.host_user = self._mk_user(Account.Role.HOST)
        self.host = HostDetail.objects.create(
            user=self.host_user,
            business_name="Eligibility Host",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        self.listing = self._mk_listing(self.host)
        self.traveller = self._mk_user(Account.Role.TRAVELLER)

    def _mk_user(self, role):
        self.__class__.account_seq += 1
        seq = self.__class__.account_seq
        return Account.objects.create(
            email=f"{role}-eligibility-{seq}@example.com",
            role=role,
            first_name="Test",
            last_name="User",
            is_active=True,
        )

    def _mk_listing(self, host):
        return Listing.objects.create(
            host=host,
            title="Eligibility Listing",
            description="Used for eligibility tests.",
            destination="Pokhara",
            location="Lakeside",
            category=Category.CULTURAL,
            activity_type=ActivityType.CITY_TOUR,
            difficulty_level=DifficultyLevel.EASY,
            ideal_for=["solo"],
            price_per_person="1200.00",
            duration_type=DurationType.FULL_DAY,
            duration_days=1,
            duration_nights=0,
            tags=["walk"],
            what_to_bring="Shoes",
            requirements="None",
            inclusions=["Guide"],
            exclusions=["Meals"],
            cancellation_policy=CancellationPolicy.MODERATE,
            languages_offered=["english"],
            best_seasons=["autumn"],
            is_active=True,
            is_bookable=True,
        )

    def _mk_completed_item(self):
        booking = Booking.objects.create(
            traveller=self.traveller,
            status=BookingStatus.CONFIRMED,
            expires_at=timezone.now(),
        )
        return BookingItem.objects.create(
            booking=booking,
            listing=self.listing,
            duration_type=self.listing.duration_type,
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            days=1,
            nights=0,
            traveller_count=1,
            status=BookingItemStatus.COMPLETED,
            snapshot={"title": self.listing.title},
            price_per_person=self.listing.price_per_person,
            subtotal=self.listing.price_per_person,
            quoted_total=self.listing.price_per_person,
            completed_at=timezone.now(),
        )

    def _review_data(self, booking_item):
        return {
            "booking_item": booking_item,
            "listing": self.listing,
            "package": None,
            "rating": 4,
            "comment": "Good experience.",
            "completion_date_snapshot": booking_item.completed_at,
        }

    def test_traveller_can_review_completed_booking_item(self):
        item = self._mk_completed_item()
        review = create_review(self.traveller, self._review_data(item))
        self.assertEqual(review.traveller, self.traveller)
        self.assertEqual(review.listing, self.listing)
        self.assertEqual(review.rating, 4)

    def test_duplicate_review_for_same_item_raises_validation_error(self):
        from rest_framework import serializers as drf_serializers
        item = self._mk_completed_item()
        create_review(self.traveller, self._review_data(item))

        with self.assertRaises(drf_serializers.ValidationError):
            create_review(self.traveller, self._review_data(item))

    def test_review_updates_listing_rating_average(self):
        item = self._mk_completed_item()
        create_review(self.traveller, self._review_data(item))
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.rating_count, 1)
        self.assertGreater(self.listing.rating_average, 0)


# ===========================================================================
# HOST REPLY
# ===========================================================================

class HostReplyTests(TestCase):
    """Tests for the host reply endpoint."""

    account_seq = 0

    def setUp(self):
        self.client = APIClient()
        self.host_user = self._mk_user(Account.Role.HOST)
        self.host = HostDetail.objects.create(
            user=self.host_user,
            business_name="Reply Host",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        self.listing = Listing.objects.create(
            host=self.host,
            title="Reply Listing",
            description="Used for host reply tests.",
            destination="Pokhara",
            location="Lakeside",
            category=Category.CULTURAL,
            activity_type=ActivityType.CITY_TOUR,
            difficulty_level=DifficultyLevel.EASY,
            ideal_for=["solo"],
            price_per_person="1200.00",
            duration_type=DurationType.FULL_DAY,
            duration_days=1,
            duration_nights=0,
            tags=["walk"],
            what_to_bring="Shoes",
            requirements="None",
            inclusions=["Guide"],
            exclusions=["Meals"],
            cancellation_policy=CancellationPolicy.MODERATE,
            languages_offered=["english"],
            best_seasons=["autumn"],
            is_active=True,
            is_bookable=True,
        )
        self.traveller = self._mk_user(Account.Role.TRAVELLER)
        self.review = Review.objects.create(
            traveller=self.traveller,
            listing=self.listing,
            rating=4,
            comment="Great trip!",
            status=ReviewStatus.PUBLISHED,
        )

    def _mk_user(self, role):
        self.__class__.account_seq += 1
        seq = self.__class__.account_seq
        return Account.objects.create(
            email=f"{role}-reply-{seq}@example.com",
            role=role,
            first_name="Test",
            last_name="User",
            is_active=True,
        )

    def _reply_url(self, pk):
        return reverse("reviews_host:host-review-reply", kwargs={"pk": pk})

    def test_host_can_add_reply(self):
        self.client.force_authenticate(user=self.host_user)
        response = self.client.post(
            self._reply_url(self.review.pk),
            {"reply": "Thank you for visiting!"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.review.refresh_from_db()
        self.assertEqual(self.review.host_reply, "Thank you for visiting!")

    def test_other_host_cannot_reply_to_another_hosts_review(self):
        other_host_user = self._mk_user(Account.Role.HOST)
        HostDetail.objects.create(
            user=other_host_user,
            business_name="Intruder Host",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        self.client.force_authenticate(user=other_host_user)
        response = self.client.post(
            self._reply_url(self.review.pk),
            {"reply": "I am not the owner."},
            format="json",
        )
        self.assertIn(response.status_code, [403, 404])

    def test_empty_reply_returns_400(self):
        self.client.force_authenticate(user=self.host_user)
        response = self.client.post(
            self._reply_url(self.review.pk),
            {"reply": ""},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_traveller_cannot_use_host_reply_endpoint(self):
        self.client.force_authenticate(user=self.traveller)
        response = self.client.post(
            self._reply_url(self.review.pk),
            {"reply": "Traveller trying to reply."},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
