import calendar as cal
from collections import defaultdict
from datetime import date, timedelta

from django.db import transaction
from django.db.models import OuterRef, Subquery, Sum, IntegerField
from django.utils import timezone
import logging

from accounts.models import Account, HostDetail
from listings.models import Listing, ListingImage, ActivitySlot
from listings.constants import UNVERIFIED_HOST_LISTING_LIMIT, UNVERIFIED_HOST_TRANSACTION_LIMIT
from utils.exceptions import ServiceError, ValidationError
from utils.files import validate_file, compress_image, create_thumbnail

logger = logging.getLogger('listings')


# CONSTANTS
MAX_IMAGES_PER_LISTING = 10


# CREATE 
@transaction.atomic
def create_listing(host: HostDetail, data: dict, images: list = None) -> Listing:
    """
    Create a new listing for a host.

    Args:
        host: HostDetail instance (the listing owner)
        data: Validated listing data from serializer
        images: Optional list of uploaded image files

    Returns:
        Created Listing instance

    Raises:
        ValidationError: If business rules are violated

    Transaction:
        This entire operation is atomic.
    """

    # check unverified host limits 
    if not host.is_verified:
        current_count = host.listings.filter(
            is_active=True,
            is_bookable=True
        ).count()

        if current_count >= UNVERIFIED_HOST_LISTING_LIMIT:
            raise ValidationError(
                detail=f"Unverified hosts can only have {UNVERIFIED_HOST_LISTING_LIMIT} active listings.",
                code="listing_limit_exceeded"
            ) 
        
    # listing slug
    listing = Listing.objects.create(host=host, **data)

    # Process images if provided
    if images:
        for index, image_file in enumerate(images):
            add_listing_image(
                listing=listing,
                image_file=image_file,
                is_primary=(index == 0),  # First image is primary
                order=index
            )

    logger.info(
        f"Listing created: id={listing.id}, host={host.user.email}, title={listing.title}"
    )

    return listing


@transaction.atomic
def add_listing_image(listing: Listing, image_file, is_primary: bool = False, order: int = 0, caption: str = "") -> ListingImage:
    """
    Add an image to a listing.

    Args:
        listing: The listing to add image to
        image_file: The uploaded file
        is_primary: Whether this is the main display image
        order: Display order in gallery
        caption: Optional image caption

    Returns:
        Created ListingImage instance

    Raises:
        ValidationError: If max images limit reached

    Side Effects:
        - Validates file (type, size)
        - Compresses image for storage optimization
        - If is_primary=True, unsets previous primary
    """
    # check max images limit
    current_image_count = listing.images.count()
    if current_image_count >= MAX_IMAGES_PER_LISTING:
        raise ValidationError(
            detail=f"Maximum {MAX_IMAGES_PER_LISTING} images per listing. Delete some images first.",
            code="max_images_exceeded"
        )
    
    # Validate the file
    validate_file(image_file)

    # Compress for storage efficiency and generate a lightweight card thumbnail.
    compressed_image = compress_image(image_file, output_format="WEBP")
    thumbnail_image = create_thumbnail(image_file, output_format="WEBP")

    # If setting as primary, unset existing primary
    if is_primary:
        listing.images.filter(is_primary=True).update(is_primary=False)

    # Create the image record
    listing_image = ListingImage.objects.create(
        listing=listing,
        image=compressed_image,
        thumbnail=thumbnail_image,
        is_primary=is_primary,
        order=order,
        caption=caption
    )

    logger.info(
        f"Image added to listing {listing.id}: is_primary={is_primary}"
    )

    return listing_image


# UPDATE 
@transaction.atomic
def update_listing(listing: Listing, data: dict) -> Listing:
    """
    Update an existing listing.

    Args:
        listing: Listing instance to update
        data: Validated update data (can be partial)

    Returns:
        Updated Listing instance
    
    Raises:
        ValidationError: If unverified host tries to publish beyond their limit.
    """
    # Publish gate 
    # Only runs when is_bookable is transitioning False → True.
    # If is_bookable is already True, there's nothing to block.
    if data.get('is_bookable') is True and not listing.is_bookable:
        if not listing.host.is_verified:
            current_count = (
                listing.host.listings
                .filter(is_active=True, is_bookable=True)
                .exclude(pk=listing.pk)
                .count()
            )
            if current_count >= UNVERIFIED_HOST_LISTING_LIMIT:
                raise ValidationError(
                    detail=(
                        f"Unverified hosts can only have "
                        f"{UNVERIFIED_HOST_LISTING_LIMIT} active listings. "
                        f"Verify your account to publish more."
                    ),
                    code="listing_limit_exceeded",
                )

            if listing.host.user.total_revenue >= UNVERIFIED_HOST_TRANSACTION_LIMIT:
                raise ValidationError(
                    detail=(
                        "You've reached your unverified transaction limit of "
                        f"NPR {UNVERIFIED_HOST_TRANSACTION_LIMIT:,.0f}. "
                        "Complete verification to publish more listings."
                    ),
                    code="transaction_limit_exceeded",
                )
            
    # update fields 
    for field, value in data.items():
        setattr(listing, field, value)
    
    listing.save()

    logger.info(f"Listing updated: id={listing.id}")

    return listing


def set_primary_image(listing_image: ListingImage) -> ListingImage:
    """
    Set an image as the primary image for its listing.
    """
    # unset current primary image
    listing_image.listing.images.filter(is_primary=True).update(is_primary=False)
    
    # Set new primary
    listing_image.is_primary = True
    listing_image.save(update_fields=['is_primary'])

    return listing_image


# DELETE OPERATIONS
@transaction.atomic
def soft_delete_listing(listing: Listing, actor=None) -> Listing:
    """
    Soft delete a listing.

    Instead of actual deletion:
    1. Set is_active = False
    2. Set is_bookable = False
    3. Remove unbooked trip-planner items that reference this listing
    """
    from bookings.models import BookingItem, BookingItemStatus
    from trip_planner.models import TripPlannerItemRemovalReason
    from trip_planner.services.trip_planner_service import remove_listing_from_active_trip_plans

    listing = Listing.objects.select_for_update().get(pk=listing.pk)

    has_active_bookings = BookingItem.objects.filter(
        listing=listing,
        status__in=[
            BookingItemStatus.PENDING_PAYMENT,
            BookingItemStatus.CONFIRMED,
        ],
    ).exists()
    if has_active_bookings:
        raise ServiceError(
            detail=(
                "This listing cannot be deleted because it has active bookings. "
                "Cancel or complete those bookings first."
            ),
            code="listing_has_active_bookings",
            status_code=409,
        )

    removal_reason = TripPlannerItemRemovalReason.HOST_DELETED_LISTING
    if actor is not None and getattr(actor, "role", None) == Account.Role.ADMIN:
        removal_reason = TripPlannerItemRemovalReason.ADMIN_DEACTIVATED_LISTING

    listing.is_active = False
    listing.is_bookable = False
    listing.save(update_fields=['is_active', 'is_bookable', 'updated_at'])
    remove_listing_from_active_trip_plans(
        listing,
        actor=actor,
        removal_reason=removal_reason,
    )

    logger.info(f"Listing soft deleted: id={listing.id}")

    return listing


def delete_listing_image(listing_image: ListingImage) -> None:
    """
    Delete a listing image.

    If deleting the primary image, the next image becomes primary.
    """
    listing = listing_image.listing
    was_primary = listing_image.is_primary

    # Delete the image (also deletes file from storage)
    listing_image.delete()

    # If was primary, promote next image
    if was_primary:
        next_image = listing.images.first()
        if next_image:
            next_image.is_primary = True
            next_image.save(update_fields=['is_primary'])

    logger.info(f"Image deleted from listing {listing.id}")


# QUERY HELPERS
def get_host_listings(host: HostDetail):
    """
    Get all listings for a specific host.

    Args:
        host: HostDetail instance
    Returns:
        QuerySet of Listing instances
    """
    queryset = Listing.objects.filter(host=host)

    queryset = queryset.filter(is_active=True)

    return queryset.select_related('host', 'host__user').prefetch_related('images')


def check_unverified_host_limits(host: HostDetail) -> dict:
    """
    Check what limits apply to an unverified host.

    Returns:
        dict with:
        - is_verified: bool
        - can_create: bool
        - listings_used: int
        - listings_limit: int
        - transaction_limit: Decimal
    """
    if host.is_verified:
        return {
            'is_verified': True,
            'can_create': True,
            'listings_used': None,
            'listings_limit': None,
            'revenue_used': None,
            'transaction_limit': None,
        }

    listings_used = host.listings.filter(
        is_active=True,
        is_bookable=True
    ).count()

    revenue_used = host.user.total_revenue

    return {
        'is_verified': False,
        'can_create': listings_used < UNVERIFIED_HOST_LISTING_LIMIT,
        'listings_used': listings_used,
        'listings_limit': UNVERIFIED_HOST_LISTING_LIMIT,
        'revenue_used': revenue_used,
        'transaction_limit': UNVERIFIED_HOST_TRANSACTION_LIMIT,
    }


# AVAILABILITY CALENDAR

def get_availability_calendar(listing: Listing, year: int, month: int, traveller_count: int) -> dict:
    """
    Compute day-by-day availability for a listing in the given month.

    Returns a dict mapping ISO date strings ("YYYY-MM-DD") to one of:
        "available"   — at least one slot has net capacity >= traveller_count
                        (net = capacity − confirmed − pending, excluding expired holds)
        "conflict"    — no slot has net capacity, but would fit if pending holds expired
        "unavailable" — no active slots on that day, or all fully confirmed-booked

    Returns an empty dict if the entire month is in the past (nothing to show).
    """
    from bookings.models import BookingItem, BookingItemStatus, BookingStatus

    today = date.today()
    first_day = date(year, month, 1)
    last_day = date(year, month, cal.monthrange(year, month)[1])
    start_from = max(first_day, today)

    if start_from > last_day:
        return {}

    slots = list(
        ActivitySlot.objects.filter(
            listing=listing,
            is_active=True,
            start_date__gte=start_from,
            start_date__lte=last_day,
        )
    )

    if not slots:
        result = {}
        current = start_from
        while current <= last_day:
            result[current.isoformat()] = "unavailable"
            current += timedelta(days=1)
        return result

    slot_ids = [s.id for s in slots]
    now = timezone.now()

    confirmed_by_slot = dict(
        BookingItem.objects
        .filter(slot_id__in=slot_ids, status=BookingItemStatus.CONFIRMED)
        .values("slot_id")
        .annotate(total=Sum("traveller_count"))
        .values_list("slot_id", "total")
    )

    pending_by_slot = dict(
        BookingItem.objects
        .filter(slot_id__in=slot_ids, status=BookingItemStatus.PENDING_PAYMENT)
        .exclude(booking__expires_at__lt=now)
        .exclude(booking__status=BookingStatus.EXPIRED)
        .values("slot_id")
        .annotate(total=Sum("traveller_count"))
        .values_list("slot_id", "total")
    )

    slots_by_date = defaultdict(list)
    for slot in slots:
        slots_by_date[slot.start_date].append(slot)

    result = {}
    current = start_from
    while current <= last_day:
        day_slots = slots_by_date.get(current)
        if not day_slots:
            result[current.isoformat()] = "unavailable"
        else:
            best = "unavailable"
            for slot in day_slots:
                confirmed = confirmed_by_slot.get(slot.id, 0)
                pending = pending_by_slot.get(slot.id, 0)
                net_avail = slot.capacity - confirmed - pending
                firm_avail = slot.capacity - confirmed

                if net_avail >= traveller_count:
                    best = "available"
                    break
                elif firm_avail >= traveller_count and best != "available":
                    best = "conflict"

            result[current.isoformat()] = best

        current += timedelta(days=1)

    return result


# SLOT QUERY HELPERS

def annotate_slots_booked_count(qs):
    """
    Annotate each ActivitySlot in the queryset with `booked_count`:
    the sum of traveller_count from active, non-expired BookingItems.

    Resolves the N+1 query problem in slot list views — callers read the
    annotation instead of hitting the DB per slot.
    """
    from bookings.models import BookingItem, BookingItemStatus, BookingStatus

    now = timezone.now()
    booked_sq = (
        BookingItem.objects
        .filter(
            slot_id=OuterRef("pk"),
            status__in=[BookingItemStatus.PENDING_PAYMENT, BookingItemStatus.CONFIRMED],
        )
        .exclude(booking__expires_at__lt=now)
        .exclude(booking__status=BookingStatus.EXPIRED)
        .values("slot_id")
        .annotate(total=Sum("traveller_count"))
        .values("total")
    )
    return qs.annotate(booked_count=Subquery(booked_sq, output_field=IntegerField()))
