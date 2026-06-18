from unittest.mock import patch

from django.db import IntegrityError
from django.test import TestCase

from accounts.models import Account, HostDetail
from listings.models import (
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
from trip_planner.models import (
    TripPlanner,
    TripPlannerItem,
    TripPlannerItemRemovalReason,
    TripStatus,
)
from trip_planner.serializers import TripPlannerDetailSerializer, TripPlannerItemReadSerializer
from trip_planner.services import trip_planner_service
from utils.exceptions import ServiceError, ValidationError


class TripPlannerAvailabilitySerializerTests(TestCase):
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
            business_name="Trip Host Co.",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        return user, host

    def create_listing(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Trip Planner Listing",
            "description": "Trip planner availability test listing.",
            "destination": "Pokhara",
            "location": "Lakeside",
            "category": Category.CULTURAL,
            "activity_type": ActivityType.CITY_TOUR,
            "difficulty_level": DifficultyLevel.EASY,
            "ideal_for": ["solo"],
            "price_per_person": "1100.00",
            "duration_type": DurationType.FULL_DAY,
            "duration_days": 1,
            "duration_nights": 0,
            "tags": ["city"],
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

    def test_trip_plan_item_marks_unbookable_listing_unavailable(self):
        traveller = self.create_account(Account.Role.TRAVELLER)
        _, host = self.create_host()
        listing = self.create_listing(host)
        trip_plan = TripPlanner.objects.create(
            traveller=traveller,
            title="Pokhara Plan",
            total_days=3,
            travellers_count=2,
            status=TripStatus.PLANNING,
        )
        item = TripPlannerItem.objects.create(
            trip_planner=trip_plan,
            listing=listing,
            day_number=1,
            order=0,
            price_snapshot="1100.00",
            duration_type_snapshot=listing.duration_type,
            duration_days_snapshot=listing.duration_days,
            duration_nights_snapshot=listing.duration_nights,
            duration_hours_snapshot=listing.average_duration_hours,
        )

        listing.is_bookable = False
        listing.save(update_fields=["is_bookable"])

        data = TripPlannerItemReadSerializer(item).data

        self.assertFalse(data["is_available_for_booking"])
        self.assertEqual(
            data["availability_message"],
            "This listing is currently unavailable for booking.",
        )

    @patch("trip_planner.services.trip_planner_service.send_ws_notification")
    def test_soft_deleted_listing_is_removed_from_trip_plan_and_notifies_traveller(self, mocked_send_ws):
        traveller = self.create_account(Account.Role.TRAVELLER)
        host_user, host = self.create_host()
        listing = self.create_listing(host)
        trip_plan = TripPlanner.objects.create(
            traveller=traveller,
            title="Pokhara Plan",
            total_days=3,
            travellers_count=2,
            status=TripStatus.PLANNING,
        )
        item = TripPlannerItem.objects.create(
            trip_planner=trip_plan,
            listing=listing,
            day_number=1,
            order=0,
            price_snapshot="1100.00",
            duration_type_snapshot=listing.duration_type,
            duration_days_snapshot=listing.duration_days,
            duration_nights_snapshot=listing.duration_nights,
            duration_hours_snapshot=listing.average_duration_hours,
        )

        with self.captureOnCommitCallbacks(execute=True):
            listing_service.soft_delete_listing(listing, actor=host_user)

        item.refresh_from_db()
        trip_plan.refresh_from_db()

        self.assertIsNotNone(item.removed_at)
        self.assertEqual(
            item.removal_reason,
            TripPlannerItemRemovalReason.HOST_DELETED_LISTING,
        )
        self.assertEqual(str(trip_plan.estimated_cost), "0.00")

        detail = TripPlannerDetailSerializer(
            trip_planner_service.get_trip_planner_detail(trip_plan)
        ).data
        self.assertEqual(detail["item_count"], 0)
        self.assertEqual(detail["items_by_day"]["1"], [])

        notification = Notification.objects.get(
            recipient=traveller,
            notification_type=NotificationType.TRIP_PLAN_ITEM_REMOVED,
        )
        self.assertEqual(notification.metadata["trip_planner_id"], trip_plan.pk)
        self.assertEqual(notification.metadata["listing_id"], listing.pk)
        self.assertEqual(notification.metadata["removed_item_count"], 1)
        self.assertEqual(mocked_send_ws.call_count, 1)

    def test_add_item_rejects_listing_from_inactive_host(self):
        traveller = self.create_account(Account.Role.TRAVELLER)
        host_user, host = self.create_host()
        listing = self.create_listing(host)
        trip_plan = TripPlanner.objects.create(
            traveller=traveller,
            title="Kathmandu Plan",
            total_days=2,
            travellers_count=1,
            status=TripStatus.PLANNING,
        )

        host_user.is_active = False
        host_user.save(update_fields=["is_active"])

        with self.assertRaises(ValidationError) as exc:
            trip_planner_service.add_item(
                trip_planner=trip_plan,
                listing=listing,
                day_number=1,
            )

        self.assertEqual(
            str(exc.exception.detail),
            "This listing is unavailable because the host account is inactive.",
        )

    def test_add_item_appends_after_existing_day_items(self):
        traveller = self.create_account(Account.Role.TRAVELLER)
        _, host = self.create_host()
        listing = self.create_listing(
            host,
            duration_type=DurationType.HOURLY,
            duration_days=0,
            duration_nights=0,
        )
        trip_plan = TripPlanner.objects.create(
            traveller=traveller,
            title="Pokhara Plan",
            total_days=2,
            travellers_count=1,
            status=TripStatus.PLANNING,
        )
        TripPlannerItem.objects.create(
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

        item = trip_planner_service.add_item(
            trip_planner=trip_plan,
            listing=listing,
            day_number=1,
            notes="Second stop",
        )

        self.assertEqual(item.order, 1)

    @patch("trip_planner.services.trip_planner_service.TripPlannerItem.objects.create")
    def test_add_item_translates_order_collision_to_service_error(self, mock_create):
        traveller = self.create_account(Account.Role.TRAVELLER)
        _, host = self.create_host()
        listing = self.create_listing(
            host,
            duration_type=DurationType.HOURLY,
            duration_days=0,
            duration_nights=0,
        )
        trip_plan = TripPlanner.objects.create(
            traveller=traveller,
            title="Order Race Plan",
            total_days=2,
            travellers_count=1,
            status=TripStatus.PLANNING,
        )
        mock_create.side_effect = IntegrityError("duplicate key value violates unique constraint")

        with self.assertRaises(ServiceError) as exc:
            trip_planner_service.add_item(
                trip_planner=trip_plan,
                listing=listing,
                day_number=1,
            )

        self.assertEqual(exc.exception.status_code, 409)
        self.assertEqual(exc.exception.get_codes(), "trip_item_order_conflict")


# ===========================================================================
# TRIP PLANNER CRUD
# ===========================================================================

class TripPlannerCRUDTests(TestCase):
    """Tests for create / update / delete of TripPlanner plans."""

    def setUp(self):
        from tests.factories import TravellerFactory, HostDetailFactory, ListingFactory
        self.traveller = TravellerFactory()
        host_user, host = HostDetailFactory.create_with_user()
        self.listing = ListingFactory(host=host, duration_type=DurationType.HOURLY, duration_days=0)

    def test_create_trip_planner(self):
        plan = trip_planner_service.create_trip_planner(
            self.traveller,
            {"title": "Kathmandu 3 Days", "total_days": 3, "travellers_count": 2},
        )
        self.assertEqual(plan.traveller, self.traveller)
        self.assertEqual(plan.status, TripStatus.PLANNING)
        self.assertEqual(plan.total_days, 3)

    def test_update_trip_planner_title(self):
        plan = trip_planner_service.create_trip_planner(
            self.traveller,
            {"title": "Old Title", "total_days": 2, "travellers_count": 1},
        )
        trip_planner_service.update_trip_planner(plan, {"title": "New Title"})
        plan.refresh_from_db()
        self.assertEqual(plan.title, "New Title")

    def test_remove_item_from_trip_plan(self):
        plan = trip_planner_service.create_trip_planner(
            self.traveller,
            {"title": "Remove Test", "total_days": 2, "travellers_count": 1},
        )
        item = trip_planner_service.add_item(
            trip_planner=plan,
            listing=self.listing,
            day_number=1,
        )
        item_pk = item.pk
        self.assertEqual(TripPlannerItem.objects.filter(trip_planner=plan).count(), 1)

        trip_planner_service.remove_item(item)

        # remove_item hard-deletes the row
        self.assertFalse(TripPlannerItem.objects.filter(pk=item_pk).exists())

    def test_estimated_cost_updates_after_add_and_remove(self):
        plan = trip_planner_service.create_trip_planner(
            self.traveller,
            {"title": "Cost Test", "total_days": 2, "travellers_count": 1},
        )
        item = trip_planner_service.add_item(
            trip_planner=plan,
            listing=self.listing,
            day_number=1,
        )
        plan.refresh_from_db()
        cost_after_add = plan.estimated_cost
        self.assertGreater(cost_after_add, 0)

        trip_planner_service.remove_item(item)
        plan.refresh_from_db()
        self.assertEqual(plan.estimated_cost, 0)


# ===========================================================================
# TRIP PLANNER OWNERSHIP ISOLATION
# ===========================================================================

class TripPlannerIsolationTests(TestCase):
    """
    A traveller's trip plan is not accessible to other travellers.
    Tests the service-level ownership checks.
    """

    def setUp(self):
        from tests.factories import TravellerFactory
        self.owner = TravellerFactory()
        self.intruder = TravellerFactory()

    def test_trip_planner_belongs_to_owner(self):
        plan = trip_planner_service.create_trip_planner(
            self.owner,
            {"title": "Owner Plan", "total_days": 3, "travellers_count": 1},
        )
        self.assertEqual(plan.traveller, self.owner)

    def test_two_travellers_have_separate_plans(self):
        plan_a = trip_planner_service.create_trip_planner(
            self.owner,
            {"title": "Plan A", "total_days": 3, "travellers_count": 1},
        )
        plan_b = trip_planner_service.create_trip_planner(
            self.intruder,
            {"title": "Plan B", "total_days": 5, "travellers_count": 2},
        )
        owner_plans = TripPlanner.objects.filter(traveller=self.owner)
        intruder_plans = TripPlanner.objects.filter(traveller=self.intruder)

        self.assertIn(plan_a, owner_plans)
        self.assertNotIn(plan_b, owner_plans)
        self.assertIn(plan_b, intruder_plans)
        self.assertNotIn(plan_a, intruder_plans)
