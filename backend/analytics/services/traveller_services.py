from django.utils import timezone

from analytics.constants import (
    TRAVELLER_ACTIVE_TRIP_PLAN_STATUSES,
    TRAVELLER_COMPLETED_BOOKING_STATUS, 
    TRAVELLER_EXCLUDED_REVIEW_STATUS,
    TRAVELLER_PREVIEW_LIMIT,
    TRAVELLER_UPCOMING_BOOKING_STATUS,
)
from bookings.models import BookingItem
from reviews.models import Review
from trip_planner.models import TripPlanner


def _booking_item_title(item: BookingItem) -> str:
    snapshot = item.snapshot if isinstance(item.snapshot, dict) else {}
    if item.listing_id:
        return snapshot.get('title') or (item.listing.title if item.listing else '')
    return snapshot.get('package_title') or (item.package.title if item.package else '')


def _serialize_upcoming_booking(item: BookingItem) -> dict:
    if item.listing_id:
        target_type = 'listing'
        target_id = item.listing_id
    else:
        target_type = 'package'
        target_id = item.package_id
    title = _booking_item_title(item)
    
    return {
        'booking_item_id': item.id,
        'booking_id': item.booking_id,
        'booking_reference': item.booking.reference,
        'target_type': target_type,
        'target_id': target_id,
        'title': title,
        'start_date': item.start_date,
        'end_date': item.end_date,
        'status': item.status,
        'quoted_total': item.quoted_total,
        'currency': item.currency,
    }


def _serialize_trip_plan(plan: TripPlanner) -> dict:
    return {
        'id': plan.id,
        'title': plan.title,
        'status': plan.status,
        'status_display': plan.get_status_display(),
        'start_date': plan.start_date,
        'end_date': plan.end_date,
        'estimated_cost': plan.estimated_cost,
        'updated_at': plan.updated_at,
    }


def get_traveller_overview(user) -> dict:
    today = timezone.localdate()

    active_trip_plans_qs = TripPlanner.objects.filter(
        traveller=user,
        status__in=TRAVELLER_ACTIVE_TRIP_PLAN_STATUSES,
    )

    upcoming_bookings_qs = BookingItem.objects.filter(
        booking__traveller=user,
        start_date__gte=today,
        status=TRAVELLER_UPCOMING_BOOKING_STATUS,
    )

    completed_trips_qs = BookingItem.objects.filter(
        booking__traveller=user,
        status=TRAVELLER_COMPLETED_BOOKING_STATUS,
    )

    reviews_written_qs = Review.objects.filter(traveller=user).exclude(
        status=TRAVELLER_EXCLUDED_REVIEW_STATUS,
    )

    upcoming_preview = upcoming_bookings_qs.select_related(
        'booking',
        'listing',
        'package',
    ).order_by('start_date', 'created_at')[:TRAVELLER_PREVIEW_LIMIT]

    trip_plan_preview = active_trip_plans_qs.order_by('-updated_at')[:TRAVELLER_PREVIEW_LIMIT]

    return {
        'summary': {
            'active_trip_plans': active_trip_plans_qs.count(),
            'upcoming_bookings': upcoming_bookings_qs.count(),
            'completed_trips': completed_trips_qs.count(),
            'reviews_written': reviews_written_qs.count(),
        },
        'previews': {
            'upcoming_bookings': [_serialize_upcoming_booking(item) for item in upcoming_preview],
            'trip_plans': [_serialize_trip_plan(plan) for plan in trip_plan_preview],
        },
    }
