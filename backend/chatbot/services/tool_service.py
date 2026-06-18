import logging

from bookings.models import Booking, BookingStatus
from listings.models import Listing
from packages.models import Package
from recommendations.services.recommendation_service import get_for_you_listings
from utils.exceptions import ServiceError

logger = logging.getLogger('chatbot')


def _booking_item_title(item) -> dict:
    snapshot = item.snapshot if isinstance(item.snapshot, dict) else {}
    return {
        'listing_title': (
            snapshot.get('title')
            or (item.listing.title if item.listing else None)
        ) if item.listing_id else None,
        'package_title': (
            snapshot.get('package_title')
            or (item.package.title if item.package else None)
        ) if item.package_id else None,
    }


def fetch_listing(listing_id: int) -> dict | None:
    """
    Fetch a listing's full details for chatbot context.

    Returns a dict with the fields needed for prompt grounding, or None if the listing does not exist or is not visible.
    """
    try:
        listing = (
            Listing.objects
            .public()
            .select_related('host', 'host__user')
            .prefetch_related('images')
            .get(pk=listing_id)
        )
    except Listing.DoesNotExist:
        return None

    primary_image = listing.primary_image

    return {
        'id': listing.id,
        'title': listing.title,
        'description': listing.description,
        'destination': listing.destination,
        'location': listing.location,
        'category': listing.get_category_display(),
        'activity_type': listing.get_activity_type_display(),
        'difficulty_level': listing.get_difficulty_level_display(),
        'ideal_for': listing.ideal_for,
        'price_per_person': str(listing.price_per_person),
        'duration_display': listing.duration_display,
        'duration_type': listing.get_duration_type_display(),
        'duration_days': listing.duration_days,
        'duration_nights': listing.duration_nights,
        'tags': listing.tags,
        'what_to_bring': listing.what_to_bring,
        'requirements': listing.requirements,
        'inclusions': listing.inclusions,
        'exclusions': listing.exclusions,
        'cancellation_policy': listing.get_cancellation_policy_display(),
        'languages_offered': listing.languages_offered,
        'best_seasons': listing.best_seasons,
        'rating_average': str(listing.rating_average),
        'rating_count': listing.rating_count,
        'booking_count': listing.booking_count,
        'max_group_size': listing.max_group_size,
        'min_group_size': listing.min_group_size,
        'instant_booking': listing.instant_booking,
        'host_name': listing.host_name,
        'is_bookable': listing.is_bookable,
        'primary_image_caption': primary_image.caption if primary_image else '',
    }


def fetch_package(package_id: int) -> dict | None:
    """
    Fetch a package's full details for chatbot context.

    Returns a dict with the fields needed for prompt grounding, or None if the package does not exist or is not active.
    """
    try:
        public_packages = Package.objects.public_ready()
        package = (
            public_packages
            .select_related('host', 'host__user')
            .prefetch_related('package_listings__listing')
            .get(pk=package_id)
        )
    except Package.DoesNotExist:
        return None

    included_listings = package.package_listings.all().order_by('day_number', 'sort_order')

    listings_info = []
    for package_listing in included_listings:
        listing = package_listing.listing
        if not (
            listing.is_active and listing.is_bookable and listing.host.user.is_active
        ):
            continue
        listings_info.append({
            'title': listing.title,
            'day_number': package_listing.day_number,
            'destination': listing.destination,
            'activity_type': listing.get_activity_type_display(),
            'notes': package_listing.notes,
        })

    return {
        'id': package.id,
        'title': package.title,
        'description': package.description,
        'duration_days': package.duration_days,
        'duration_nights': package.duration_nights,
        'total_price': str(package.total_price),
        'discount_label': package.discount_label,
        'max_group_size': package.max_group_size,
        'tags': package.tags,
        'inclusions': package.inclusions,
        'highlights': package.highlights,
        'terms_and_conditions': package.terms_and_conditions,
        'valid_from': str(package.valid_from) if package.valid_from else None,
        'valid_until': str(package.valid_until) if package.valid_until else None,
        'is_bookable': package.is_bookable,
        'rating_average': str(package.rating_average),
        'rating_count': package.rating_count,
        'booking_count': package.booking_count,
        'host_name': package.host.business_name or package.host.user.full_name,
        'included_listings': listings_info,
    }


def search_listings(
    destination: str = '',
    category: str = '',
    activity_type: str = '',
    max_price: float | None = None,
    difficulty: str = '',
    limit: int = 5,
) -> list[dict]:
    """
    Search listings with optional filters for general suggestion context.

    Returns a list of listing summary dicts.
    """
    queryset = Listing.objects.public()

    if destination:
        queryset = queryset.filter(destination__icontains=destination)
    if category:
        queryset = queryset.filter(category=category)
    if activity_type:
        queryset = queryset.filter(activity_type=activity_type)
    if max_price is not None:
        queryset = queryset.filter(price_per_person__lte=max_price)
    if difficulty:
        queryset = queryset.filter(difficulty_level=difficulty)

    queryset = queryset.order_by('-rating_average', '-booking_count')[:limit]

    results = []
    for listing in queryset:
        results.append({
            'id': listing.id,
            'title': listing.title,
            'destination': listing.destination,
            'category': listing.get_category_display(),
            'activity_type': listing.get_activity_type_display(),
            'price_per_person': str(listing.price_per_person),
            'duration_display': listing.duration_display,
            'rating_average': str(listing.rating_average),
            'rating_count': listing.rating_count,
            'difficulty_level': listing.get_difficulty_level_display(),
        })

    return results


def get_upcoming_bookings(user) -> list[dict]:
    """
    Get the authenticated traveller's upcoming/active bookings.

    Returns a list of booking summary dicts.
    """
    bookings = (
        Booking.objects
        .filter(
            traveller=user,
            status__in=[BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT],
        )
        .prefetch_related('items', 'items__listing', 'items__package')
        .order_by('-created_at')[:10]
    )

    results = []
    for booking in bookings:
        items = []
        for item in booking.items.all():
            title_data = _booking_item_title(item)
            items.append({
                'listing_title': title_data['listing_title'],
                'package_title': title_data['package_title'],
                'start_date': str(item.start_date) if item.start_date else None,
                'end_date': str(item.end_date) if item.end_date else None,
                'start_time': str(item.start_time) if item.start_time else None,
                'traveller_count': item.traveller_count,
                'status': item.get_status_display(),
            })

        results.append({
            'reference': booking.reference,
            'status': booking.get_status_display(),
            'total': str(booking.quoted_total),
            'created_at': booking.created_at.strftime('%Y-%m-%d %H:%M'),
            'items': items,
        })

    return results


def get_recommendations(user, limit: int = 5) -> list[dict]:
    """
    Get personalised listing recommendations for an authenticated traveller.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        raise ServiceError(
            detail='Authentication required for recommendations.',
            code='authentication_required',
            status_code=401,
        )

    try:
        recommendation_result = get_for_you_listings(user, limit=limit)
    except Exception as e:
        logger.error(
            "Failed to get recommendations for user %s: %s",
            getattr(user, 'pk', None),
            str(e),
        )
        return []

    if not recommendation_result.listing_ids:
        return []

    listings_by_id = {
        listing.id: listing
        for listing in Listing.objects.filter(
            pk__in=recommendation_result.listing_ids,
            is_active=True,
            is_bookable=True,
        )
    }

    results_detail_map = {
        item['listing_id']: item
        for item in recommendation_result.results_detail
    }

    results = []
    for listing_id in recommendation_result.listing_ids:
        listing = listings_by_id.get(listing_id)
        if listing is None:
            continue

        detail = results_detail_map.get(listing_id, {})
        results.append({
            'id': listing.id,
            'title': listing.title,
            'destination': listing.destination,
            'category': listing.get_category_display(),
            'activity_type': listing.get_activity_type_display(),
            'price_per_person': str(listing.price_per_person),
            'duration_display': listing.duration_display,
            'rating_average': str(listing.rating_average),
            'rating_count': listing.rating_count,
            'strategy': recommendation_result.strategy,
            'distance': float(detail['distance']) if detail.get('distance') is not None else None,
        })

    return results
