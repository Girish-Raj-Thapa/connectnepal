"""
ConnectNepal shared test factories.

Every app's tests.py imports from here instead of defining its own
create_account / create_host / create_listing helpers.

Usage
-----
    from tests.factories import (
        AccountFactory, HostDetailFactory, ListingFactory,
        ActivitySlotFactory, BookingFactory, BookingItemFactory,
        PaymentAttemptFactory, TripPlannerFactory, PackageFactory,
    )

    class MyTests(TestCase):
        def test_something(self):
            traveller = AccountFactory()
            host_user, host = HostDetailFactory.create_with_user()
            listing = ListingFactory(host=host)
            slot = ActivitySlotFactory(listing=listing)
"""

import factory
from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone

from accounts.models import Account, HostDetail, TravellerDetail
from bookings.models import (
    AvailabilityHold,
    Booking,
    BookingItem,
    BookingItemStatus,
    BookingSource,
    BookingStatus,
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
from packages.models import Package
from payments.models import AttemptStatus, PaymentAttempt, PaymentProvider
from trip_planner.models import TripPlanner, TripPlannerItem, TripStatus


# ============================================================================
# ACCOUNT FACTORIES
# ============================================================================

class AccountFactory(factory.django.DjangoModelFactory):
    """
    Default: active traveller account.
    No password is set — use force_authenticate() in view tests.
    For tests that need a real login, call user.set_password() in setUp.
    """

    class Meta:
        model = Account

    email = factory.Sequence(lambda n: f"user-{n}@example.com")
    role = Account.Role.TRAVELLER
    first_name = "Test"
    last_name = "User"
    is_active = True


class TravellerFactory(AccountFactory):
    role = Account.Role.TRAVELLER


class HostUserFactory(AccountFactory):
    """
    Account row with HOST role. Pair with HostDetailFactory for a full host.
    """
    role = Account.Role.HOST


class AdminFactory(AccountFactory):
    role = Account.Role.ADMIN
    is_admin = True
    is_staff = True


# ============================================================================
# HOST DETAIL FACTORY
# ============================================================================

class HostDetailFactory(factory.django.DjangoModelFactory):
    """
    Creates HostDetail + the paired host Account automatically.

    Shortcut
    --------
    host_user, host = HostDetailFactory.create_with_user()

    Traits
    ------
    unverified  — NOT_SUBMITTED  (for listing-limit and transaction-limit tests)
    pending     — PENDING
    """

    class Meta:
        model = HostDetail

    user = factory.SubFactory(HostUserFactory)
    business_name = factory.Sequence(lambda n: f"Host Business {n}")
    verification_status = HostDetail.VerificationStatus.APPROVED

    class Params:
        unverified = factory.Trait(
            verification_status=HostDetail.VerificationStatus.NOT_SUBMITTED
        )
        pending = factory.Trait(
            verification_status=HostDetail.VerificationStatus.PENDING
        )

    @classmethod
    def create_with_user(cls, **kwargs):
        """Return (host_user, host_detail) — mirrors existing test convention."""
        host = cls.create(**kwargs)
        return host.user, host


# ============================================================================
# TRAVELLER DETAIL FACTORY
# ============================================================================

class TravellerDetailFactory(factory.django.DjangoModelFactory):

    class Meta:
        model = TravellerDetail

    user = factory.SubFactory(TravellerFactory)
    preferred_activities = ["hiking", "cultural"]
    preferred_min_budget = Decimal("500.00")
    preferred_max_budget = Decimal("5000.00")
    preferred_trip_style = "solo"


# ============================================================================
# LISTING FACTORY
# ============================================================================

class ListingFactory(factory.django.DjangoModelFactory):
    """
    Full listing owned by a verified host.
    slug and average_duration_hours are auto-computed by Listing.save().

    Traits
    ------
    inactive    — is_active=False, is_bookable=False
    unpublished — is_bookable=False only
    multiday    — MULTI_DAY with 3 days / 2 nights
    """

    class Meta:
        model = Listing

    host = factory.SubFactory(HostDetailFactory)
    title = factory.Sequence(lambda n: f"Test Listing {n}")
    description = "A test listing used in automated tests."
    destination = "Pokhara"
    location = "Lakeside, Pokhara"
    category = Category.CULTURAL
    activity_type = ActivityType.CITY_TOUR
    difficulty_level = DifficultyLevel.EASY
    ideal_for = ["solo"]
    price_per_person = Decimal("1200.00")
    duration_type = DurationType.FULL_DAY
    duration_days = 1
    duration_nights = 0
    tags = ["culture"]
    what_to_bring = "Comfortable shoes"
    requirements = "None"
    inclusions = ["Guide"]
    exclusions = ["Meals"]
    cancellation_policy = CancellationPolicy.MODERATE
    languages_offered = ["english"]
    best_seasons = ["autumn"]
    max_group_size = 10
    min_group_size = 1
    is_active = True
    is_bookable = True

    class Params:
        inactive = factory.Trait(is_active=False, is_bookable=False)
        unpublished = factory.Trait(is_bookable=False)
        multiday = factory.Trait(
            duration_type=DurationType.MULTI_DAY,
            duration_days=3,
            duration_nights=2,
        )


# ============================================================================
# ACTIVITY SLOT FACTORY
# ============================================================================

class ActivitySlotFactory(factory.django.DjangoModelFactory):
    """
    Default: 7 days from today, capacity 10, active.

    Traits
    ------
    past — start/end date in the past (excluded from public slot list)
    """

    class Meta:
        model = ActivitySlot

    listing = factory.SubFactory(ListingFactory)
    start_date = factory.LazyFunction(lambda: date.today() + timedelta(days=7))
    end_date = factory.LazyFunction(lambda: date.today() + timedelta(days=7))
    capacity = 10
    is_active = True

    class Params:
        past = factory.Trait(
            start_date=factory.LazyFunction(lambda: date.today() - timedelta(days=7)),
            end_date=factory.LazyFunction(lambda: date.today() - timedelta(days=7)),
        )


# ============================================================================
# BOOKING FACTORIES
# ============================================================================

class BookingFactory(factory.django.DjangoModelFactory):
    """
    Default: pending_payment, 15-minute expiry window.

    Traits
    ------
    confirmed — CONFIRMED, confirmed_at populated
    completed — COMPLETED
    cancelled — CANCELLED
    expired   — EXPIRED, expires_at in the past
    """

    class Meta:
        model = Booking

    traveller = factory.SubFactory(TravellerFactory)
    source = BookingSource.DIRECT
    status = BookingStatus.PENDING_PAYMENT
    expires_at = factory.LazyFunction(
        lambda: timezone.now() + timedelta(minutes=15)
    )
    quoted_total = Decimal("1416.00")  # 1200 × 1.05 fee × 1.13 VAT, 1 person

    class Params:
        confirmed = factory.Trait(
            status=BookingStatus.CONFIRMED,
            confirmed_at=factory.LazyFunction(timezone.now),
        )
        completed = factory.Trait(status=BookingStatus.COMPLETED)
        cancelled = factory.Trait(status=BookingStatus.CANCELLED)
        expired = factory.Trait(
            status=BookingStatus.EXPIRED,
            expires_at=factory.LazyFunction(
                lambda: timezone.now() - timedelta(hours=1)
            ),
        )


class BookingItemFactory(factory.django.DjangoModelFactory):
    """
    Pricing defaults match 1 person × NPR 1200 FULL_DAY:
        subtotal     = 1200.00
        fee_amount   =   60.00  (5%)
        tax_amount   =  156.00  (13%)
        gross_amount = 1416.00

    Traits
    ------
    confirmed — CONFIRMED
    completed — COMPLETED, completed_at set
    cancelled — CANCELLED
    expired   — EXPIRED
    """

    class Meta:
        model = BookingItem

    booking = factory.SubFactory(BookingFactory)
    listing = factory.SubFactory(ListingFactory)
    duration_type = DurationType.FULL_DAY
    start_date = factory.LazyFunction(lambda: date.today() + timedelta(days=7))
    end_date = factory.LazyFunction(lambda: date.today() + timedelta(days=7))
    days = 1
    nights = 0
    traveller_count = 1
    status = BookingItemStatus.PENDING_PAYMENT
    snapshot = {"title": "Test Listing Snapshot"}
    price_per_person = Decimal("1200.00")
    subtotal = Decimal("1200.00")
    fee_amount = Decimal("60.00")
    tax_amount = Decimal("156.00")
    gross_amount = Decimal("1416.00")
    quoted_total = Decimal("1416.00")

    class Params:
        confirmed = factory.Trait(status=BookingItemStatus.CONFIRMED)
        completed = factory.Trait(
            status=BookingItemStatus.COMPLETED,
            completed_at=factory.LazyFunction(timezone.now),
        )
        cancelled = factory.Trait(status=BookingItemStatus.CANCELLED)
        expired = factory.Trait(status=BookingItemStatus.EXPIRED)


# ============================================================================
# AVAILABILITY HOLD FACTORY
# ============================================================================

class AvailabilityHoldFactory(factory.django.DjangoModelFactory):

    class Meta:
        model = AvailabilityHold

    listing = factory.SubFactory(ListingFactory)
    traveller = factory.SubFactory(TravellerFactory)
    duration_type = DurationType.FULL_DAY
    start_date = factory.LazyFunction(lambda: date.today() + timedelta(days=7))
    end_date = factory.LazyFunction(lambda: date.today() + timedelta(days=7))
    traveller_count = 1
    expires_at = factory.LazyFunction(
        lambda: timezone.now() + timedelta(minutes=15)
    )
    is_released = False


# ============================================================================
# PAYMENT FACTORY
# ============================================================================

class PaymentAttemptFactory(factory.django.DjangoModelFactory):

    class Meta:
        model = PaymentAttempt

    booking = factory.SubFactory(BookingFactory)
    user = factory.LazyAttribute(lambda obj: obj.booking.traveller)
    provider = PaymentProvider.ESEWA
    transaction_uuid = factory.Sequence(lambda n: f"txn-uuid-{n:010d}")
    expected_amount = Decimal("1416.00")
    amount_str = "1416.00"
    status = AttemptStatus.INITIATED


# ============================================================================
# TRIP PLANNER FACTORIES
# ============================================================================

class TripPlannerFactory(factory.django.DjangoModelFactory):

    class Meta:
        model = TripPlanner

    traveller = factory.SubFactory(TravellerFactory)
    title = factory.Sequence(lambda n: f"Trip Plan {n}")
    total_days = 3
    travellers_count = 1
    status = TripStatus.PLANNING
    estimated_cost = Decimal("0.00")


class TripPlannerItemFactory(factory.django.DjangoModelFactory):

    class Meta:
        model = TripPlannerItem

    trip_planner = factory.SubFactory(TripPlannerFactory)
    listing = factory.SubFactory(ListingFactory)
    day_number = 1
    order = 0
    price_snapshot = Decimal("1200.00")
    duration_type_snapshot = DurationType.FULL_DAY
    duration_days_snapshot = 1
    duration_nights_snapshot = 0
    duration_hours_snapshot = Decimal("8.0")


# ============================================================================
# PACKAGE FACTORY
# ============================================================================

class PackageFactory(factory.django.DjangoModelFactory):

    class Meta:
        model = Package

    host = factory.SubFactory(HostDetailFactory)
    title = factory.Sequence(lambda n: f"Package {n}")
    slug = factory.Sequence(lambda n: f"package-{n}")
    description = "A test package."
    duration_days = 3
    duration_nights = 2
    total_price = Decimal("5000.00")
    max_group_size = 10
    is_active = True
    is_bookable = True