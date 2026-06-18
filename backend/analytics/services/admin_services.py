from django.db.models import Avg, Count, DecimalField, IntegerField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce, TruncMonth

from accounts.models import Account, HostDetail
from analytics.constants import (
    ADMIN_RECENT_ACTIVITY_LIMIT,
    ADMIN_TOP_PERFORMANCE_LIMIT,
    HOST_COUNTABLE_BOOKING_ITEM_STATUSES,
    PUBLISHED_REVIEW_STATUS,
    TREND_MONTH_COUNT,
    ZERO_MONEY,
    ZERO_RATING,
)
from analytics.selectors import (
    month_start_to_aware_datetime,
    recent_booking_history_queryset,
    recent_host_verifications_queryset,
    recent_review_events_queryset,
    rolling_month_starts,
    shift_month,
    zero_fill_count_series,
    zero_fill_decimal_series,
)
from bookings.models import Booking, BookingItem
from complaints.models import Complaint, ComplaintStatus
from listings.models import Category, Listing
from packages.models import Package
from payments.models import Payment
from reviews.models import Review


MONEY_FIELD = DecimalField(max_digits=12, decimal_places=2)
RATING_FIELD = DecimalField(max_digits=3, decimal_places=2)


def _serialize_booking_activity(record) -> dict:
    actor = record.changed_by
    entity_type = 'booking_item' if record.booking_item_id else 'booking'
    entity_id = record.booking_item_id or record.booking_id
    entity_label = 'Booking item' if record.booking_item_id else 'Booking'

    if record.from_status:
        description = f'{entity_label} status changed from {record.from_status} to {record.to_status}.'
    else:
        description = f'{entity_label} status set to {record.to_status}.'

    return {
        'source': 'booking_status_history',
        'occurred_at': record.changed_at,
        'actor_name': actor.full_name if actor else 'System',
        'actor_role': actor.role if actor else 'system',
        'action': 'status_changed',
        'entity_type': entity_type,
        'entity_id': entity_id,
        'label': record.booking.reference or f'Booking {record.booking_id}',
        'description': description,
    }


def _review_target_title(review) -> str:
    booking_item = getattr(review, 'booking_item', None)
    snapshot = getattr(booking_item, 'snapshot', None)
    if not isinstance(snapshot, dict):
        snapshot = {}

    if review.listing_id:
        return snapshot.get('title') or (review.listing.title if review.listing else None)
    if review.package_id:
        return snapshot.get('package_title') or (review.package.title if review.package else None)
    return None


def _serialize_review_activity(event) -> dict:
    actor = event.actor
    target_title = _review_target_title(event.review)

    description = f"Review event '{event.event_type}' recorded"
    if target_title:
        description = f"{description} for {target_title}."
    else:
        description = f'{description}.'

    return {
        'source': 'review_event',
        'occurred_at': event.created_at,
        'actor_name': actor.full_name if actor else 'System',
        'actor_role': event.actor_role,
        'action': event.event_type,
        'entity_type': 'review',
        'entity_id': event.review_id,
        'label': f'Review {event.review_id}',
        'description': description,
    }


def _serialize_host_verification_activity(host_detail: HostDetail) -> dict:
    action = 'host_approved'
    if host_detail.verification_status == HostDetail.VerificationStatus.REJECTED:
        action = 'host_rejected'

    label = host_detail.business_name or host_detail.user.full_name
    actor = host_detail.verified_by

    return {
        'source': 'host_verification',
        'occurred_at': host_detail.verified_at,
        'actor_name': actor.full_name if actor else 'Admin',
        'actor_role': actor.role if actor else 'admin',
        'action': action,
        'entity_type': 'host',
        'entity_id': host_detail.pk,
        'label': label,
        'description': f'Host verification marked {host_detail.verification_status} for {label}.',
    }


def _serialize_top_listing(listing: Listing) -> dict:
    return {
        'listing_id': listing.id,
        'title': listing.title,
        'host_id': listing.host_id,
        'host_name': listing.host.business_name or listing.host.user.full_name,
        'booking_count': listing.booking_count,
        'rating_average': listing.rating_average,
        'rating_count': listing.rating_count,
    }


def _serialize_top_host(host_detail: HostDetail) -> dict:
    host_name = host_detail.business_name or host_detail.user.full_name
    return {
        'host_id': host_detail.pk,
        'host_name': host_name,
        'business_name': host_detail.business_name,
        'booking_count': host_detail.booking_count,
        'average_rating': host_detail.average_rating,
        'review_count': host_detail.review_count,
        'verification_status': host_detail.verification_status,
    }


def get_admin_overview() -> dict:
    month_starts = rolling_month_starts(TREND_MONTH_COUNT)
    current_month_start = month_starts[-1]
    next_month_start = shift_month(current_month_start, 1)
    window_start_at = month_start_to_aware_datetime(month_starts[0])
    next_month_start_at = month_start_to_aware_datetime(next_month_start)

    published_reviews_qs = Review.objects.filter(status=PUBLISHED_REVIEW_STATUS)

    monthly_revenue_rows = Payment.objects.filter(
        paid_at__gte=window_start_at,
        paid_at__lt=next_month_start_at,
    ).annotate(
        month=TruncMonth('paid_at'),
    ).values('month').annotate(
        amount=Coalesce(Sum('amount'), Value(ZERO_MONEY, output_field=MONEY_FIELD)),
    ).order_by('month')

    monthly_bookings_rows = Booking.objects.filter(
        created_at__gte=window_start_at,
        created_at__lt=next_month_start_at,
    ).annotate(
        month=TruncMonth('created_at'),
    ).values('month').annotate(
        count=Count('id'),
    ).order_by('month')

    category_labels = dict(Category.choices)
    listings_by_category = [
        {
            'category': row['category'],
            'category_display': category_labels.get(row['category'], row['category']),
            'count': row['count'],
        }
        for row in Listing.objects.filter(is_active=True).values('category').annotate(
            count=Count('id'),
        ).order_by('-count', 'category')
    ]

    booking_activity = [
        _serialize_booking_activity(record)
        for record in recent_booking_history_queryset()[:ADMIN_RECENT_ACTIVITY_LIMIT]
    ]

    review_activity = [
        _serialize_review_activity(event)
        for event in recent_review_events_queryset()[:ADMIN_RECENT_ACTIVITY_LIMIT]
    ]

    host_verification_activity = [
        _serialize_host_verification_activity(host_detail)
        for host_detail in recent_host_verifications_queryset()[:ADMIN_RECENT_ACTIVITY_LIMIT]
    ]
    
    recent_activity = sorted(
        booking_activity + review_activity + host_verification_activity,
        key=lambda item: item['occurred_at'],
        reverse=True,
    )[:ADMIN_RECENT_ACTIVITY_LIMIT]

    top_listings = Listing.objects.filter(
        is_active=True,
    ).select_related(
        'host',
        'host__user',
    ).order_by(
        '-booking_count',
        '-rating_average',
        '-rating_count',
        'id',
    )[:ADMIN_TOP_PERFORMANCE_LIMIT]

    booking_count_subquery = BookingItem.objects.filter(
        Q(listing__host=OuterRef('pk')) | Q(package__host=OuterRef('pk')),
        status__in=HOST_COUNTABLE_BOOKING_ITEM_STATUSES,
    ).order_by().annotate(
        group_key=Value(1),
    ).values('group_key').annotate(
        total=Count('id'),
    ).values('total')[:1]

    average_rating_subquery = Review.objects.filter(
        Q(listing__host=OuterRef('pk')) | Q(package__host=OuterRef('pk')),
        status=PUBLISHED_REVIEW_STATUS,
    ).order_by().annotate(
        group_key=Value(1),
    ).values('group_key').annotate(
        avg=Avg('rating'),
    ).values('avg')[:1]

    review_count_subquery = Review.objects.filter(
        Q(listing__host=OuterRef('pk')) | Q(package__host=OuterRef('pk')),
        status=PUBLISHED_REVIEW_STATUS,
    ).order_by().annotate(
        group_key=Value(1),
    ).values('group_key').annotate(
        total=Count('id'),
    ).values('total')[:1]

    top_hosts = HostDetail.objects.filter(
        verification_status=HostDetail.VerificationStatus.APPROVED,
    ).select_related(
        'user',
    ).annotate(
        booking_count=Coalesce(
            Subquery(booking_count_subquery, output_field=IntegerField()),
            Value(0, output_field=IntegerField()),
        ),
        average_rating=Coalesce(
            Subquery(average_rating_subquery, output_field=RATING_FIELD),
            Value(ZERO_RATING, output_field=RATING_FIELD),
        ),
        review_count=Coalesce(
            Subquery(review_count_subquery, output_field=IntegerField()),
            Value(0, output_field=IntegerField()),
        ),
    ).order_by(
        '-booking_count',
        '-average_rating',
        '-review_count',
        'pk',
    )[:ADMIN_TOP_PERFORMANCE_LIMIT]

    return {
        'summary': {
            'total_users': Account.objects.count(),
            'active_hosts': HostDetail.objects.filter(
                verification_status=HostDetail.VerificationStatus.APPROVED,
            ).count(),
            'total_listings': Listing.objects.filter(is_active=True).count(),
            'total_revenue': Payment.objects.aggregate(
                total=Coalesce(Sum('amount'), Value(ZERO_MONEY, output_field=MONEY_FIELD)),
            )['total'],
            'total_bookings': Booking.objects.count(),
            'active_packages': Package.objects.filter(is_active=True, is_bookable=True).count(),
            'total_reviews': published_reviews_qs.count(),
            'average_platform_rating': published_reviews_qs.aggregate(avg=Avg('rating'))['avg'] or ZERO_RATING,
            'open_complaints': Complaint.objects.exclude(
                status__in=[
                    ComplaintStatus.RESOLVED,
                    ComplaintStatus.REJECTED,
                    ComplaintStatus.CLOSED,
                ]
            ).count(),
        },
        'trends': {
            'monthly_revenue': zero_fill_decimal_series(monthly_revenue_rows, month_starts),
            'monthly_bookings': zero_fill_count_series(monthly_bookings_rows, month_starts),
        },
        'distributions': {
            'listings_by_category': listings_by_category,
        },
        'previews': {
            'recent_activity': recent_activity,
        },
        'top_performance': {
            'listings': [_serialize_top_listing(listing) for listing in top_listings],
            'hosts': [_serialize_top_host(host_detail) for host_detail in top_hosts],
        },
    }
