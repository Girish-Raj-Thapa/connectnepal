from django.db.models import Avg, Count, DecimalField, Sum, Value
from django.db.models.functions import Coalesce, TruncMonth

from accounts.models import HostDetail
from analytics.constants import (
    HOST_COUNTABLE_BOOKING_ITEM_STATUSES,
    HOST_EARNINGS_PAYMENT_STATUS,
    HOST_PREVIEW_LIMIT,
    PUBLISHED_REVIEW_STATUS,
    TREND_MONTH_COUNT,
    ZERO_MONEY,
    ZERO_RATING,
)
from analytics.selectors import (
    host_owned_booking_items_queryset,
    host_published_reviews_queryset,
    month_start_to_aware_datetime,
    rolling_month_starts,
    shift_month,
    zero_fill_count_series,
    zero_fill_decimal_series,
)
from listings.models import Listing


MONEY_FIELD = DecimalField(max_digits=12, decimal_places=2)


def _empty_host_overview() -> dict:
    return {
        'summary': {
            'active_listings': 0,
            'total_bookings': 0,
            'this_month_earnings': ZERO_MONEY,
            'average_rating': ZERO_RATING,
            'review_count': 0,
        },
        'trends': {
            'monthly_earnings': [],
            'monthly_bookings': [],
        },
        'previews': {
            'recent_bookings': [],
            'top_performing_listings': [],
        },
    }


def _booking_item_title(item) -> str:
    snapshot = item.snapshot if isinstance(item.snapshot, dict) else {}
    if item.listing_id:
        return snapshot.get('title') or (item.listing.title if item.listing else '')
    return snapshot.get('package_title') or (item.package.title if item.package else '')


def _serialize_recent_booking(item) -> dict:
    if item.listing_id:
        target_type = 'listing'
        target_id = item.listing_id
    else:
        target_type = 'package'
        target_id = item.package_id
    title = _booking_item_title(item)
    
    traveller = item.booking.traveller
    return {
        'booking_item_id': item.id,
        'booking_id': item.booking_id,
        'booking_reference': item.booking.reference,
        'target_type': target_type,
        'target_id': target_id,
        'title': title,
        'traveller_name': traveller.full_name if traveller else None,
        'traveller_email': traveller.email if traveller else None,
        'status': item.status,
        'start_date': item.start_date,
        'end_date': item.end_date,
        'quoted_total': item.quoted_total,
        'currency': item.currency,
        'created_at': item.created_at,
    }


def _serialize_top_listing(listing: Listing) -> dict:
    return {
        'listing_id': listing.id,
        'title': listing.title,
        'category': listing.category,
        'destination': listing.destination,
        'booking_count': listing.booking_count,
        'rating_average': listing.rating_average,
        'rating_count': listing.rating_count,
        'is_active': listing.is_active,
        'is_bookable': listing.is_bookable,
    }


def get_host_overview(user) -> dict:
    try: 
        host_detail = user.host_detail
    except HostDetail.DoesNotExist:
        return _empty_host_overview()
    
    month_starts = rolling_month_starts(TREND_MONTH_COUNT)
    current_month_start = month_starts[-1]
    next_month_start = shift_month(current_month_start, 1)
    window_start_at = month_start_to_aware_datetime(month_starts[0])
    current_month_start_at = month_start_to_aware_datetime(current_month_start)
    next_month_start_at = month_start_to_aware_datetime(next_month_start)

    host_items_qs = host_owned_booking_items_queryset(host_detail)
    published_reviews_qs = host_published_reviews_queryset(host_detail)

    review_summary = published_reviews_qs.aggregate(
        average_rating=Avg('rating'),
        review_count=Count('id'),
    )

    this_month_earnings = host_items_qs.filter(
        booking__payment_status=HOST_EARNINGS_PAYMENT_STATUS,
        booking__paid_at__gte=current_month_start_at,
        booking__paid_at__lt=next_month_start_at,
    ).aggregate(
        total=Coalesce(Sum('quoted_total'), Value(ZERO_MONEY, output_field=MONEY_FIELD)),
    )['total']

    monthly_earnings_rows = host_items_qs.filter(
        booking__payment_status=HOST_EARNINGS_PAYMENT_STATUS,
        booking__paid_at__gte=window_start_at,
        booking__paid_at__lt=next_month_start_at,
    ).annotate(
        month=TruncMonth('booking__paid_at'),
    ).values('month').annotate(
        amount=Coalesce(Sum('quoted_total'), Value(ZERO_MONEY, output_field=MONEY_FIELD)),
    ).order_by('month')

    monthly_bookings_rows = host_items_qs.filter(
        status__in=HOST_COUNTABLE_BOOKING_ITEM_STATUSES,
        created_at__gte=window_start_at,
        created_at__lt=next_month_start_at,
    ).annotate(
        month=TruncMonth('created_at'),
    ).values('month').annotate(
        count=Count('id'),
    ).order_by('month')

    recent_bookings = host_items_qs.select_related(
        'booking__traveller',
        'listing',
        'package',
    ).order_by('-created_at')[:HOST_PREVIEW_LIMIT]

    top_listings = Listing.objects.filter(
        host=host_detail,
        is_active=True,
    ).order_by(
        '-booking_count',
        '-rating_average',
        '-rating_count',
        'id',
    )[:HOST_PREVIEW_LIMIT]

    return {
        'summary': {
            'active_listings': Listing.objects.filter(
                host=host_detail,
                is_active=True,
                is_bookable=True,
            ).count(),
            'total_bookings': host_items_qs.filter(
                status__in=HOST_COUNTABLE_BOOKING_ITEM_STATUSES,
            ).count(),
            'this_month_earnings': this_month_earnings,
            'average_rating': review_summary['average_rating'] or ZERO_RATING,
            'review_count': review_summary['review_count'],
        },
        'trends': {
            'monthly_earnings': zero_fill_decimal_series(monthly_earnings_rows, month_starts),
            'monthly_bookings': zero_fill_count_series(monthly_bookings_rows, month_starts),
        },
        'previews': {
            'recent_bookings': [_serialize_recent_booking(item) for item in recent_bookings],
            'top_performing_listings': [_serialize_top_listing(listing) for listing in top_listings],
        },
    }
