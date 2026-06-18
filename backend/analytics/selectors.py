from datetime import date, datetime, time
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone

from accounts.models import HostDetail
from bookings.models import BookingItem, BookingStatusHistory
from reviews.models import Review, ReviewEvent, ReviewStatus


def shift_month(month_start: date, offset: int) -> date:
    month_index = (month_start.year * 12 + month_start.month - 1) + offset
    year, month_zero_index = divmod(month_index, 12)
    return date(year, month_zero_index + 1, 1)


def rolling_month_starts(month_count: int) -> list[date]:
    current_month_start = timezone.localdate().replace(day=1)
    first_month_start = shift_month(current_month_start, -(month_count - 1))
    return [shift_month(first_month_start, index) for index in range(month_count)]


def month_start_to_aware_datetime(month_start: date) -> datetime:
    return timezone.make_aware(
        datetime.combine(month_start, time.min),
        timezone.get_current_timezone(),
    )


def month_key(value: date) -> str:
    return value.strftime('%Y-%m')


def zero_fill_count_series(rows, month_starts: list[date], value_key: str = 'count') -> list[dict]:
    row_map = {}
    for row in rows:
        month_value = row.get('month')
        if month_value is None:
            continue
        if hasattr(month_value, 'date'):
            month_value = month_value.date()
        row_map[month_key(month_value)] = int(row.get(value_key) or 0)
    
    return [
        {'month': month_key(month_start), 'count': row_map.get(month_key(month_start), 0)}
        for month_start in month_starts
    ]


def zero_fill_decimal_series(rows, month_starts: list[date], value_key: str = 'amount') -> list[dict]:
    row_map = {}
    for row in rows:
        month_value = row.get('month')
        if month_value is None:
            continue
        if hasattr(month_value, 'date'):
            month_value = month_value.date()
        row_map[month_key(month_value)] = row.get(value_key) or Decimal('0.00')

    return [
        {'month': month_key(month_start), 'amount': row_map.get(month_key(month_start), Decimal('0.00'))}
        for month_start in month_starts
    ]


def host_owned_booking_items_queryset(host_detail: HostDetail):
    return BookingItem.objects.filter(
        Q(listing__host=host_detail) | Q(package__host=host_detail)
    )


def host_published_reviews_queryset(host_detail: HostDetail):
    return Review.objects.filter(
        Q(listing__host=host_detail) | Q(package__host=host_detail),
        status=ReviewStatus.PUBLISHED,
    )


def recent_booking_history_queryset():
    return BookingStatusHistory.objects.select_related(
        'booking',
        'booking_item',
        'changed_by',
    ).order_by('-changed_at')


def recent_review_events_queryset():
    return ReviewEvent.objects.select_related(
        'review',
        'review__booking_item',
        'actor',
        'review__listing',
        'review__package',
    ).order_by('-created_at')


def recent_host_verifications_queryset():
    return HostDetail.objects.filter(
        verified_at__isnull=False,
        verification_status__in=[
            HostDetail.VerificationStatus.APPROVED,
            HostDetail.VerificationStatus.REJECTED,
        ],
    ).select_related('user', 'verified_by').order_by('-verified_at')
