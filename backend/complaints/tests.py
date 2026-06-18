from datetime import timedelta
from unittest.mock import patch

from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone

from accounts.models import Account, HostDetail
from bookings.models import Booking, BookingItem, BookingItemStatus, BookingStatus
from complaints.models import (
    Complaint,
    ComplaintCategory,
    ComplaintSeverity,
    ComplaintStatus,
    FiledByRole,
)
from complaints.serializers import (
    AdminComplaintDetailSerializer,
    ComplaintDetailSerializer,
    ComplaintListSerializer,
    ComplaintRespondentDetailSerializer,
)
from complaints.services.complaint_service import (
    admin_escalate,
    admin_request_info,
    create_complaint as create_complaint_service,
)
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
from utils.exceptions import ServiceError


class ComplaintNotificationTests(TestCase):
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
            "business_name": "Complaint Host Co.",
            "verification_status": HostDetail.VerificationStatus.APPROVED,
        }
        defaults.update(overrides)
        return HostDetail.objects.create(**defaults)

    def create_listing(self, host):
        return Listing.objects.create(
            host=host,
            title="Kathmandu Heritage Walk",
            description="Guided old city walk",
            destination="Kathmandu",
            location="Basantapur",
            category=Category.HERITAGE,
            activity_type=ActivityType.CITY_TOUR,
            difficulty_level=DifficultyLevel.EASY,
            ideal_for=["families"],
            price_per_person="900.00",
            duration_type=DurationType.FULL_DAY,
            duration_days=1,
            duration_nights=0,
            tags=["history"],
            what_to_bring="Water",
            requirements="None",
            inclusions=["Guide"],
            exclusions=["Transport"],
            cancellation_policy=CancellationPolicy.MODERATE,
            languages_offered=["english"],
            best_seasons=["autumn"],
            is_active=True,
            is_bookable=True,
        )

    def create_booking_item(self, traveller, listing):
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.CONFIRMED,
            expires_at=timezone.now() + timedelta(days=1),
        )
        booking_item = BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            days=1,
            nights=0,
            traveller_count=2,
            status=BookingItemStatus.CONFIRMED,
            snapshot={"title": listing.title},
            price_per_person=listing.price_per_person,
            subtotal=listing.price_per_person,
            quoted_total=listing.price_per_person,
        )
        return booking, booking_item

    def create_complaint(self, *, status=ComplaintStatus.SUBMITTED):
        traveller = self.create_account(Account.Role.TRAVELLER)
        host = self.create_host()
        listing = self.create_listing(host)
        booking, booking_item = self.create_booking_item(traveller, listing)
        complaint = Complaint.objects.create(
            booking_item=booking_item,
            booking=booking,
            filed_by=traveller,
            filed_by_role=FiledByRole.TRAVELLER,
            listing=listing,
            complaint_against_user=host.user,
            category=ComplaintCategory.MISLEADING_LISTING,
            title="Listing mismatch",
            description="The listing details were misleading.",
            severity=ComplaintSeverity.MEDIUM,
            status=status,
        )
        return complaint

    @patch("complaints.services.complaint_service.send_ws_notification")
    def test_request_info_notifies_complainant_with_specific_copy(self, mocked_send_ws):
        admin = self.create_account(Account.Role.ADMIN)
        complaint = self.create_complaint()

        with self.captureOnCommitCallbacks(execute=True):
            admin_request_info(complaint, admin, note="Please upload a screenshot.")

        complaint.refresh_from_db()
        notification = Notification.objects.get(
            recipient=complaint.filed_by,
            notification_type=NotificationType.COMPLAINT_STATUS_CHANGED,
        )

        self.assertEqual(complaint.status, ComplaintStatus.NEEDS_MORE_INFO)
        self.assertEqual(notification.title, "More Information Requested")
        self.assertIn("need more information", notification.body.lower())
        self.assertEqual(mocked_send_ws.call_count, 1)

    @patch("complaints.services.complaint_service.send_ws_notification")
    def test_escalate_notifies_both_parties(self, mocked_send_ws):
        admin = self.create_account(Account.Role.ADMIN)
        complaint = self.create_complaint(status=ComplaintStatus.TRIAGED)

        with self.captureOnCommitCallbacks(execute=True):
            admin_escalate(complaint, admin, note="Escalating for senior review.")

        complaint.refresh_from_db()
        notifications = Notification.objects.filter(
            notification_type=NotificationType.COMPLAINT_STATUS_CHANGED,
        ).order_by("recipient_id")

        self.assertEqual(complaint.status, ComplaintStatus.ESCALATED)
        self.assertEqual(notifications.count(), 2)
        self.assertEqual(
            {notification.recipient_id for notification in notifications},
            {complaint.filed_by_id, complaint.complaint_against_user_id},
        )
        self.assertTrue(
            all(notification.title == "Complaint Escalated" for notification in notifications)
        )
        self.assertEqual(mocked_send_ws.call_count, 2)


class ComplaintSnapshotSerializerTests(TestCase):
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
            business_name="Snapshot Complaint Co.",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        return user, host

    def create_listing(self, host):
        return Listing.objects.create(
            host=host,
            title="Original Complaint Listing",
            description="Guided old city walk",
            destination="Kathmandu",
            location="Basantapur",
            category=Category.HERITAGE,
            activity_type=ActivityType.CITY_TOUR,
            difficulty_level=DifficultyLevel.EASY,
            ideal_for=["families"],
            price_per_person="900.00",
            duration_type=DurationType.FULL_DAY,
            duration_days=1,
            duration_nights=0,
            tags=["history"],
            what_to_bring="Water",
            requirements="None",
            inclusions=["Guide"],
            exclusions=["Transport"],
            cancellation_policy=CancellationPolicy.MODERATE,
            languages_offered=["english"],
            best_seasons=["autumn"],
            is_active=True,
            is_bookable=True,
        )

    def test_complaint_serializers_use_booking_snapshot_for_soft_deleted_listing(self):
        traveller = self.create_account(Account.Role.TRAVELLER)
        host_user, host = self.create_host()
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.CONFIRMED,
            expires_at=timezone.now() + timedelta(days=1),
        )
        listing = self.create_listing(host)
        booking_item = BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            days=1,
            nights=0,
            traveller_count=2,
            status=BookingItemStatus.COMPLETED,
            snapshot={"title": "Snapshot Complaint Listing"},
            price_per_person=listing.price_per_person,
            subtotal=listing.price_per_person,
            quoted_total=listing.price_per_person,
            completed_at=timezone.now(),
        )
        complaint = Complaint.objects.create(
            booking_item=booking_item,
            booking=booking,
            filed_by=traveller,
            filed_by_role=FiledByRole.TRAVELLER,
            listing=listing,
            complaint_against_user=host_user,
            category=ComplaintCategory.MISLEADING_LISTING,
            title="Listing mismatch",
            description="The listing details were misleading.",
            severity=ComplaintSeverity.MEDIUM,
            status=ComplaintStatus.SUBMITTED,
        )

        listing.title = "Live Complaint Listing"
        listing.is_active = False
        listing.is_bookable = False
        listing.save(update_fields=["title", "is_active", "is_bookable"])

        self.assertEqual(
            ComplaintListSerializer(complaint).data["target_label"],
            "Listing: Snapshot Complaint Listing",
        )
        self.assertEqual(
            ComplaintDetailSerializer(complaint).data["listing_title"],
            "Snapshot Complaint Listing",
        )
        self.assertEqual(
            ComplaintRespondentDetailSerializer(complaint).data["listing_title"],
            "Snapshot Complaint Listing",
        )
        self.assertEqual(
            AdminComplaintDetailSerializer(complaint).data["listing_title"],
            "Snapshot Complaint Listing",
        )


class ComplaintIntegrityTests(TestCase):
    account_seq = 0

    def create_account(self, role, **overrides):
        self.__class__.account_seq += 1
        seq = self.__class__.account_seq
        defaults = {
            "email": f"{role}-integrity-{seq}@example.com",
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
            business_name="Integrity Host Co.",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )

    def create_listing(self, host):
        return Listing.objects.create(
            host=host,
            title="Complaint Integrity Listing",
            description="Guided old city walk",
            destination="Kathmandu",
            location="Basantapur",
            category=Category.HERITAGE,
            activity_type=ActivityType.CITY_TOUR,
            difficulty_level=DifficultyLevel.EASY,
            ideal_for=["families"],
            price_per_person="900.00",
            duration_type=DurationType.FULL_DAY,
            duration_days=1,
            duration_nights=0,
            tags=["history"],
            what_to_bring="Water",
            requirements="None",
            inclusions=["Guide"],
            exclusions=["Transport"],
            cancellation_policy=CancellationPolicy.MODERATE,
            languages_offered=["english"],
            best_seasons=["autumn"],
            is_active=True,
            is_bookable=True,
        )

    def create_completed_booking_item(self):
        traveller = self.create_account(Account.Role.TRAVELLER)
        host = self.create_host()
        listing = self.create_listing(host)
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.CONFIRMED,
            expires_at=timezone.now() + timedelta(days=1),
        )
        booking_item = BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            days=1,
            nights=0,
            traveller_count=2,
            status=BookingItemStatus.COMPLETED,
            snapshot={"title": listing.title},
            price_per_person=listing.price_per_person,
            subtotal=listing.price_per_person,
            quoted_total=listing.price_per_person,
            completed_at=timezone.now(),
        )
        return traveller, host, listing, booking, booking_item

    def build_validated_data(self, booking_item):
        return {
            "booking_item": booking_item,
            "category": ComplaintCategory.MISLEADING_LISTING,
            "title": "Listing details were misleading",
            "description": "The advertised itinerary did not match the experience at all.",
            "filed_by_role": FiledByRole.TRAVELLER,
        }

    def test_resolved_complaint_allows_refile_for_same_booking_item(self):
        traveller, host, listing, booking, booking_item = self.create_completed_booking_item()
        Complaint.objects.create(
            booking_item=booking_item,
            booking=booking,
            filed_by=traveller,
            filed_by_role=FiledByRole.TRAVELLER,
            listing=listing,
            complaint_against_user=host.user,
            category=ComplaintCategory.MISLEADING_LISTING,
            title="Resolved complaint",
            description="Old complaint",
            severity=ComplaintSeverity.MEDIUM,
            status=ComplaintStatus.RESOLVED,
        )

        complaint = create_complaint_service(
            traveller,
            self.build_validated_data(booking_item),
        )

        self.assertEqual(Complaint.objects.count(), 2)
        self.assertEqual(complaint.status, ComplaintStatus.SUBMITTED)
        self.assertEqual(complaint.booking_item_id, booking_item.pk)

    @patch("complaints.services.complaint_service.Complaint.objects.create")
    def test_duplicate_active_complaint_race_translates_integrity_error(self, mock_create):
        traveller, _, _, _, booking_item = self.create_completed_booking_item()
        mock_create.side_effect = IntegrityError("duplicate key value violates unique constraint")

        with self.assertRaises(ServiceError) as exc:
            create_complaint_service(
                traveller,
                self.build_validated_data(booking_item),
            )

        self.assertEqual(exc.exception.status_code, 409)
        self.assertEqual(exc.exception.get_codes(), "duplicate_complaint")
