from unittest.mock import patch

from django.db import IntegrityError
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import Account, HostDetail
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
from packages.services import (
    package_schedule_service,
    package_service,
    package_slot_service,
)
from utils.exceptions import ServiceError


class AdminPackageNotificationTests(TestCase):
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
            business_name="Package Host Co.",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        return user, host

    def create_package(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Annapurna Weekend Escape",
            "slug": "annapurna-weekend-escape",
            "description": "Two-day guided package.",
            "duration_days": 2,
            "duration_nights": 1,
            "total_price": "6500.00",
            "max_group_size": 8,
            "is_active": True,
            "is_bookable": True,
        }
        defaults.update(overrides)
        return Package.objects.create(**defaults)

    @patch("packages.views.admin_views.send_ws_notification")
    def test_admin_deactivate_package_notifies_host_once(self, mocked_send_ws):
        admin = self.create_account(Account.Role.ADMIN)
        host_user, host = self.create_host()
        package = self.create_package(host)
        self.client.force_authenticate(user=admin)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"/api/packages/admin/{package.pk}/deactivate/")

        package.refresh_from_db()
        notification = Notification.objects.get(
            recipient=host_user,
            notification_type=NotificationType.PACKAGE_DEACTIVATED,
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(package.is_active)
        self.assertFalse(package.is_bookable)
        self.assertEqual(notification.metadata["package_id"], package.pk)
        self.assertEqual(mocked_send_ws.call_count, 1)

        with self.captureOnCommitCallbacks(execute=True):
            second_response = self.client.post(f"/api/packages/admin/{package.pk}/deactivate/")

        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(
            Notification.objects.filter(
                recipient=host_user,
                notification_type=NotificationType.PACKAGE_DEACTIVATED,
            ).count(),
            1,
        )

    @patch("packages.views.admin_views.send_ws_notification")
    def test_admin_activate_package_notifies_host(self, mocked_send_ws):
        admin = self.create_account(Account.Role.ADMIN)
        host_user, host = self.create_host()
        package = self.create_package(host, is_active=False, is_bookable=False)
        self.client.force_authenticate(user=admin)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"/api/packages/admin/{package.pk}/activate/")

        package.refresh_from_db()
        notification = Notification.objects.get(
            recipient=host_user,
            notification_type=NotificationType.PACKAGE_ACTIVATED,
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(package.is_active)
        self.assertFalse(package.is_bookable)
        self.assertEqual(notification.metadata["package_id"], package.pk)
        self.assertEqual(mocked_send_ws.call_count, 1)


class PublicPackageVisibilityTests(TestCase):
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
            business_name="Package Visibility Co.",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        return user, host

    def create_listing(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Package Listing",
            "description": "A listing used in package visibility tests.",
            "destination": "Pokhara",
            "location": "Lakeside",
            "category": Category.CULTURAL,
            "activity_type": ActivityType.CITY_TOUR,
            "difficulty_level": DifficultyLevel.EASY,
            "ideal_for": ["solo"],
            "price_per_person": "1500.00",
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

    def create_package(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Visibility Package",
            "slug": "visibility-package",
            "description": "A package used in public visibility tests.",
            "duration_days": 2,
            "duration_nights": 1,
            "total_price": "7000.00",
            "max_group_size": 8,
            "is_active": True,
            "is_bookable": True,
        }
        defaults.update(overrides)
        return Package.objects.create(**defaults)

    def test_public_package_endpoints_hide_package_when_included_listing_is_soft_deleted(self):
        _, host = self.create_host()
        listing_one = self.create_listing(host, title="Package Listing One")
        listing_two = self.create_listing(host, title="Package Listing Two")
        package = self.create_package(host)
        PackageListing.objects.create(package=package, listing=listing_one, sort_order=0)
        PackageListing.objects.create(package=package, listing=listing_two, sort_order=1)

        listing_two.is_active = False
        listing_two.is_bookable = False
        listing_two.save(update_fields=["is_active", "is_bookable"])

        list_response = self.client.get(reverse("packages:package-list"))
        self.assertEqual(list_response.status_code, 200)
        payload = list_response.json()
        results = payload["results"] if "results" in payload else payload
        listed_ids = {item["id"] for item in results}
        self.assertNotIn(package.pk, listed_ids)

        detail_response = self.client.get(
            reverse("packages:package-detail", kwargs={"pk": package.pk})
        )
        self.assertEqual(detail_response.status_code, 404)


class HostPackageRepairFlowTests(TestCase):
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
            business_name="Repair Flow Co.",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        return user, host

    def create_listing(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Package Repair Listing",
            "description": "A listing used in host package repair flow tests.",
            "destination": "Kathmandu",
            "location": "Thamel",
            "category": Category.CULTURAL,
            "activity_type": ActivityType.CITY_TOUR,
            "difficulty_level": DifficultyLevel.EASY,
            "ideal_for": ["solo"],
            "price_per_person": "1500.00",
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

    def create_package(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Repair Flow Package",
            "slug": "repair-flow-package",
            "description": "A package used in host package repair flow tests.",
            "duration_days": 2,
            "duration_nights": 1,
            "total_price": "9000.00",
            "max_group_size": 8,
            "is_active": True,
            "is_bookable": False,
        }
        defaults.update(overrides)
        return Package.objects.create(**defaults)

    def test_host_package_detail_flags_unavailable_listings_and_blocks_publish(self):
        host_user, host = self.create_host()
        listing_one = self.create_listing(host, title="Listing One")
        listing_two = self.create_listing(host, title="Listing Two")
        package = self.create_package(host)
        PackageListing.objects.create(package=package, listing=listing_one, sort_order=0)
        PackageListing.objects.create(package=package, listing=listing_two, sort_order=1)

        listing_two.is_active = False
        listing_two.is_bookable = False
        listing_two.save(update_fields=["is_active", "is_bookable"])

        self.client.force_authenticate(user=host_user)

        detail_response = self.client.get(
            reverse("packages:host-package-detail", kwargs={"pk": package.pk})
        )
        self.assertEqual(detail_response.status_code, 200)
        payload = detail_response.json()
        self.assertEqual(payload["listing_count"], 2)
        self.assertEqual(payload["active_listing_count"], 1)
        self.assertTrue(payload["has_unavailable_listings"])
        self.assertFalse(payload["can_publish"])
        self.assertEqual(
            payload["publish_issue"],
            "At least 2 active and bookable listings are required.",
        )

        listing_payload = next(
            listing_data
            for listing_data in payload["package_listings"]
            if listing_data["listing_id"] == listing_two.pk
        )
        self.assertFalse(listing_payload["is_available_for_package"])
        self.assertEqual(
            listing_payload["availability_message"],
            "Listing was removed by the host.",
        )

        publish_response = self.client.patch(
            reverse("packages:host-package-detail", kwargs={"pk": package.pk}),
            {"is_bookable": True},
            format="json",
        )
        self.assertEqual(publish_response.status_code, 400)
        self.assertIn("at least 2 active and bookable listings", str(publish_response.json()).lower())


class PackageServiceHardeningTests(TestCase):
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
        return HostDetail.objects.create(
            user=user,
            business_name="Package Service Co.",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )

    def create_package(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Service Package",
            "slug": "service-package",
            "description": "Package for service tests.",
            "duration_days": 2,
            "duration_nights": 1,
            "total_price": "5500.00",
            "max_group_size": 6,
            "is_active": True,
            "is_bookable": False,
        }
        defaults.update(overrides)
        return Package.objects.create(**defaults)

    def test_create_slot_translates_unique_collision_to_service_error(self):
        package = self.create_package(self.create_host())

        with patch(
            "packages.services.package_slot_service.PackageSlot.objects.create",
            side_effect=IntegrityError,
        ):
            with self.assertRaises(ServiceError) as exc_info:
                package_slot_service.create_slot(
                    package,
                    {
                        "start_date": "2026-05-01",
                        "end_date": "2026-05-02",
                        "capacity": 6,
                        "is_active": True,
                    },
                )

        self.assertEqual(exc_info.exception.status_code, 409)
        self.assertEqual(exc_info.exception.get_codes(), "slot_already_exists")

    def test_create_exception_translates_unique_collision_to_service_error(self):
        package = self.create_package(self.create_host())

        with patch(
            "packages.services.package_schedule_service.PackageSlotException.objects.create",
            side_effect=IntegrityError,
        ):
            with self.assertRaises(ServiceError) as exc_info:
                package_schedule_service.create_exception(
                    package,
                    {
                        "date": "2026-05-01",
                        "is_closed": True,
                        "capacity_override": None,
                        "note": "",
                    },
                )

        self.assertEqual(exc_info.exception.status_code, 409)
        self.assertEqual(exc_info.exception.get_codes(), "exception_already_exists")

    def test_create_package_retries_when_slug_collides_during_create(self):
        host = self.create_host()
        self.create_package(
            host,
            title="Race Package",
            slug="race-package",
        )

        with patch(
            "packages.services.package_service._generate_unique_slug",
            side_effect=["race-package", "race-package-1"],
        ):
            package = package_service.create_package_with_listings(
                host,
                {
                    "title": "Race Package",
                    "description": "Retried package slug generation.",
                    "duration_days": 2,
                    "duration_nights": 1,
                    "total_price": "6200.00",
                    "max_group_size": 8,
                    "listing_ids": [],
                },
            )

        self.assertEqual(package.slug, "race-package-1")
