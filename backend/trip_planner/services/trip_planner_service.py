from django.db import IntegrityError, transaction, models
from django.db.models import Count, Prefetch, Q, Sum
from decimal import Decimal
import logging

from accounts.models import Account
from listings.models import Listing, DurationType
from notifications.constants import NotificationPriority, NotificationType
from notifications.services.notification_realtime_service import send_ws_notification
from notifications.services.notification_service import create_notification
from trip_planner.models import (
    TripPlannerItem,
    TripPlanner,
    TripStatus,
    TripPlannerItemRemovalReason,
)
from utils.exceptions import ServiceError, ValidationError

logger = logging.getLogger('trip_planner')


def _queue_ws_notification(notification):
    if notification:
        transaction.on_commit(lambda n=notification: send_ws_notification(n))


def _active_items(trip_planner: TripPlanner):
    return trip_planner.items.active()


# =========================
# CREATE
# =========================

@transaction.atomic
def create_trip_planner(traveller: Account, data: dict) -> TripPlanner:
    """
    Create a new trip plan for a traveller.

    Args:
        traveller: Account instance (must have role=traveller)
        data: Validated data from serializer

    Returns:
        Created TripPlan instance
    """

    trip_planner = TripPlanner.objects.create(
        traveller=traveller,
        **data,
    )

    logger.info(
        f"Trip plan created: id={trip_planner.id}, user={traveller.email}, title={trip_planner.title}"
    )

    return trip_planner


# =========================
# UPDATE
# =========================

@transaction.atomic
def update_trip_planner(trip_planner: TripPlanner, data: dict) -> TripPlanner:
    """
    Update an existing trip plan.

    Args:
        trip_planner: TripPlanner instance to update
        data: Validated update data (can be partial)

    Returns:
        Updated TripPlan instance

    Side Effects:
        - If total_days is reduced, validates no items exist beyond new limit
        - Recalculates estimated_cost if travellers_count changes
    """

    new_total_days = data.get('total_days')
    if new_total_days is not None:
        # Check that no items exist beyond the new total_days
        overflow_items = _active_items(trip_planner).filter(day_number__gt=new_total_days)

        if overflow_items.exists():
            raise ValidationError(
                detail=f"Cannot reduce total_days to {new_total_days}. "
                    f"Items exist on days beyond this limit. Remove or move them first.",
                code="items_overflow",
            )

    for field, value in data.items():
        setattr(trip_planner, field, value)

    # Recalculate cost if travellers_count changed
    if 'travellers_count' in data:
        trip_planner.estimated_cost = _calculate_estimated_cost(trip_planner)
    
    trip_planner.save()

    logger.info(f"Trip plan updated: id={trip_planner.id}")

    return trip_planner


def archive_trip_planner(trip_planner: TripPlanner) -> TripPlanner:
    """
    Soft archive a trip plan by setting status to archived.

    This is the DELETE behavior — no hard deletes.
    """
    trip_planner.status = TripStatus.ARCHIVED
    trip_planner.save(update_fields=['status', 'updated_at'])

    logger.info(f"Trip plan archived: id={trip_planner.id}")

    return trip_planner


# =========================
# ITEMS
# =========================
@transaction.atomic
def add_item(trip_planner: TripPlanner, listing: Listing, day_number: int, notes: str = "") -> TripPlannerItem:
    """
    Add a listing to a trip plan day.

    Args:
        trip_planner: The parent plan
        listing: The listing to add
        day_number: Which day (1-based)
        notes: Optional traveller notes

    Returns:
        Created TripPlannerItem

    Raises:
        ValidationError: If listing is not bookable or day_number is out of range

    Side Effects:
        - Snapshots price_per_person and average_duration_hours
        - Auto-assigns order as last in the day (0-based)
        - Recalculates estimated_cost on the plan
    """
    # Validate listing is available for planning/bookable flows.
    if not listing.host.user.is_active:
        raise ValidationError(
            detail="This listing is unavailable because the host account is inactive.",
            code="listing_unavailable"
        )
    if not listing.is_active:
        raise ValidationError(
            detail="This listing was removed by the host.",
            code="listing_unavailable"
        )
    if not listing.is_bookable:
        raise ValidationError(
            detail="This listing is currently unavailable for booking.",
            code="listing_unavailable"
        )

    trip_planner = TripPlanner.objects.select_for_update().get(pk=trip_planner.pk)

    _validate_item_placement(
        trip_planner=trip_planner,
        day_number=day_number,
        duration_type=listing.duration_type,
        duration_days=listing.duration_days,
        duration_nights=listing.duration_nights,
    )
 
    # Auto-assign order: append to end of the day (0-based)
    max_order = trip_planner.items.filter(
        day_number=day_number
    ).aggregate(
        max_order=models.Max('order')
    )['max_order']

    next_order = (max_order + 1) if max_order is not None else 0

    # Create item with snapshots
    try:
        item = TripPlannerItem.objects.create(
            trip_planner=trip_planner,
            listing=listing,
            day_number=day_number,
            order=next_order,
            price_snapshot=listing.price_per_person,
            duration_type_snapshot=listing.duration_type,
            duration_days_snapshot=listing.duration_days,
            duration_nights_snapshot=listing.duration_nights,
            duration_hours_snapshot=listing.average_duration_hours,
            notes=notes,
        )
    except IntegrityError:
        raise ServiceError(
            detail="Another item was added to this trip day at the same time. Please try again.",
            code="trip_item_order_conflict",
            status_code=409,
        )

    _recalculate_cost(trip_planner)
    _refresh_cover_image(trip_planner)
    _sync_plan_status(trip_planner)

    logger.info(
        f"Item added to trip {trip_planner.id}: listing={listing.id}, day={day_number}"
    )

    return item


def update_item(item: TripPlannerItem, data: dict) -> TripPlannerItem:
    """
    Update a trip planner item (move day, reorder, edit notes).

    Args:
        item: TripPlannerItem instance
        data: Validated update data

    Returns:
        Updated TripPlannerItem
    """
    trip_planner = item.trip_planner

    new_day = data.get('day_number')
    if new_day is not None:
        _validate_item_placement(
            trip_planner=trip_planner,
            day_number=new_day,
            duration_type=item.duration_type_snapshot,
            duration_days=item.duration_days_snapshot,
            duration_nights=item.duration_nights_snapshot,
            exclude_item_id=item.id,
        )

    for field, value in data.items():
        setattr(item, field, value)

    item.save()   

    logger.info(f"Item updated: id={item.id}, trip={trip_planner.id}")

    return item


@transaction.atomic
def remove_item(item: TripPlannerItem) -> None:
    """
    Remove an item from a trip plan.

    Side Effects:
        - Deletes the item
        - Recalculates estimated_cost on the plan
    """
    trip_planner = item.trip_planner
    item.delete()

    _recalculate_cost(trip_planner)
    _refresh_cover_image(trip_planner)
    _sync_plan_status(trip_planner)

    logger.info(f"Item removed from trip {trip_planner.id}")



@transaction.atomic
def remove_listing_from_active_trip_plans(
    listing: Listing,
    *,
    actor: Account | None = None,
    removal_reason: str = TripPlannerItemRemovalReason.HOST_DELETED_LISTING,
) -> int:
    """
    Soft-remove unbooked trip-plan items when a listing is no longer available.
    """
    removable_items = list(
        TripPlannerItem.objects.active()
        .filter(listing=listing, booked_at__isnull=True)
        .exclude(trip_planner__status=TripStatus.ARCHIVED)
        .select_related("trip_planner", "trip_planner__traveller")
        .order_by("trip_planner_id", "day_number", "order")
    )

    if not removable_items:
        return 0

    item_ids = [item.pk for item in removable_items]
    plans_by_id = {}
    for item in removable_items:
        plans_by_id.setdefault(
            item.trip_planner_id,
            {
                "trip_plan": item.trip_planner,
                "traveller": item.trip_planner.traveller,
                "removed_item_count": 0,
            },
        )
        plans_by_id[item.trip_planner_id]["removed_item_count"] += 1

    TripPlannerItem.objects.filter(pk__in=item_ids).update(
        removed_at=models.functions.Now(),
        removal_reason=removal_reason,
    )

    for payload in plans_by_id.values():
        trip_plan = payload["trip_plan"]
        _recalculate_cost(trip_plan)
        _refresh_cover_image(trip_plan)
        _sync_plan_status(trip_plan)

        count = payload["removed_item_count"]
        message = (
            f'The listing "{listing.title}" was removed from your trip plan because '
            f'{_removal_message_suffix(removal_reason)}.'
        )
        if count > 1:
            message = (
                f'The listing "{listing.title}" was removed from your trip plan in '
                f'{count} places because {_removal_message_suffix(removal_reason)}.'
            )

        notification = create_notification(
            recipient=payload["traveller"],
            actor=actor,
            notification_type=NotificationType.TRIP_PLAN_ITEM_REMOVED,
            title="Trip Plan Updated",
            body=message,
            action_url=f"/trip-planner/{trip_plan.pk}",
            metadata={
                "trip_planner_id": trip_plan.pk,
                "listing_id": listing.pk,
                "listing_title": listing.title,
                "removed_item_count": count,
                "removal_reason": removal_reason,
            },
            priority=NotificationPriority.HIGH,
            dedupe_key=(
                f"trip_plan_item_removed:{trip_plan.pk}:"
                f"{listing.pk}:{removal_reason}"
            ),
        )
        _queue_ws_notification(notification)

    logger.info(
        "Trip planner items soft removed for listing %s: %s item(s) across %s plan(s)",
        listing.pk,
        len(item_ids),
        len(plans_by_id),
    )

    return len(item_ids)


@transaction.atomic
def bulk_reorder_items(trip_planner: TripPlanner, reorder_data: list) -> None:
    """
    Bulk update day_number and order for multiple items.

    Args:
        trip_planner: The parent planner
        reorder_data: List of dicts: [{"item_id": int, "day_number": int, "order": int}, ...]

    Raises:
        ValidationError: If any item_id doesn't belong to this plan or day_number is out of range
    """
    # Fetch all items for this plan in one query
    item_ids = [entry['item_id'] for entry in reorder_data]
    items = _active_items(trip_planner).all()
    items_map = {item.id: item for item in items}

    # Validate all payload items belong to this plan
    payload_missing = set(item_ids) - set(items_map.keys())
    if payload_missing:
        raise ValidationError(
            detail=f"Items not found in this plan: {payload_missing}",
            code="invalid_items"
        )

    updates = {entry['item_id']: entry for entry in reorder_data}

    # Build effective positions for all items (payload overrides existing)
    effective = []
    for item in items:
        update = updates.get(item.id)
        day = update['day_number'] if update else item.day_number
        order = update['order'] if update else item.order
        if day < 1 or day > trip_planner.total_days:
            raise ValidationError(
                detail=f"day_number must be between 1 and {trip_planner.total_days}.",
                code="invalid_day_number"
            )
        effective.append((item, day, order))

    _validate_reorder_constraints(trip_planner, effective)

    # Apply updates only to payload items
    for item in items:
        update = updates.get(item.id)
        if update:
            item.day_number = update['day_number']
            item.order = update['order']

    TripPlannerItem.objects.bulk_update(
        [items_map[item_id] for item_id in item_ids],
        fields=['day_number', 'order']
    )

    logger.info(f"Bulk reorder on trip {trip_planner.id}: {len(reorder_data)} items")


# =========================
# QUERY HELPERS
# =========================
def get_user_trip_planners(traveller: Account, status_filter: str = None):
    """
    Get trip planners for a traveller, optionally filtered by status.

    Returns:
        QuerySet of TripPlanner instances with item counts annotated
    """
    queryset = TripPlanner.objects.filter(traveller=traveller)

    if status_filter:
        queryset = queryset.filter(status=status_filter)

    return queryset.annotate(
        item_count=Count('items', filter=Q(items__removed_at__isnull=True))
    ).order_by('-updated_at')


def get_trip_planner_detail(trip_planner: TripPlanner):
    """
    Get a trip planner with items eagerly loaded and grouped-ready.

    Returns:
        TripPlanner with prefetched items and their listings
    """
    # Refresh with optimized queries
    return TripPlanner.objects.filter(
        id=trip_planner.id
    ).prefetch_related(
        Prefetch(
            'items',
            queryset=TripPlannerItem.objects.active().select_related(
                'listing',
                'listing__host',
                'listing__host__user',
            ).prefetch_related(
                'listing__images'
            ).order_by('day_number', 'order'),
        ),
    ).first()


# =========================
# INTERNAL HELPERS
# =========================
def _get_block_length(duration_type: str, duration_days: int, duration_nights: int) -> int:
    """
    Determine how many days an item blocks on the planner timeline.
    """
    if duration_type == DurationType.HOURLY:
        return 0
    if duration_type == DurationType.FULL_DAY:
        return 1
    if duration_days and duration_days > 0:
        return duration_days
    if duration_nights and duration_nights > 0:
        return duration_nights + 1
    return 1


def _validate_item_placement(
    trip_planner: TripPlanner,
    day_number: int,
    duration_type: str,
    duration_days: int,
    duration_nights: int,
    exclude_item_id: int = None,
) -> None:
    """
    Validate placement rules for hourly/full-day/multi-day experiences.
    """
    if day_number < 1 or day_number > trip_planner.total_days:
        raise ValidationError(
            detail=f"day_number must be between 1 and {trip_planner.total_days}.",
            code="invalid_day_number"
        )

    items = _active_items(trip_planner)
    if exclude_item_id:
        items = items.exclude(id=exclude_item_id)

    # Build blocked days from full-day and multi-day items
    blocked_days = set()
    for item in items:
        if item.duration_type_snapshot == DurationType.HOURLY:
            continue
        length = _get_block_length(
            item.duration_type_snapshot,
            item.duration_days_snapshot,
            item.duration_nights_snapshot,
        )
        for d in range(item.day_number, item.day_number + length):
            blocked_days.add(d)

    if duration_type == DurationType.HOURLY:
        if day_number in blocked_days:
            raise ValidationError(
                detail="Hourly experience cannot be placed on a blocked day.",
                code="day_blocked"
            )
        return

    # FULL_DAY / MULTI_DAY
    length = _get_block_length(duration_type, duration_days, duration_nights)
    end_day = day_number + length - 1
    if end_day > trip_planner.total_days:
        raise ValidationError(
            detail=f"day_number must be between 1 and {trip_planner.total_days}.",
            code="invalid_day_number"
        )

    for d in range(day_number, end_day + 1):
        if d in blocked_days:
            raise ValidationError(
                detail="Selected day range is blocked by existing experiences.",
                code="day_blocked"
            )

    # Disallow any items (including hourly) in the blocked range
    if items.filter(day_number__gte=day_number, day_number__lte=end_day).exists():
        raise ValidationError(
            detail="Selected day range is blocked by existing experiences.",
            code="day_blocked"
        )


def _validate_reorder_constraints(trip_planner: TripPlanner, effective_positions: list) -> None:
    """
    Validate bulk reorder for blocking rules and unique ordering per day.

    effective_positions: list of (item, day_number, order)
    """
    # Ensure unique order per day
    seen = set()
    for _, day, order in effective_positions:
        key = (day, order)
        if key in seen:
            raise ValidationError(
                detail="Duplicate order values within the same day.",
                code="duplicate_order"
            )
        seen.add(key)

    # Blocked day validation for full/multi-day items
    blocked_days = set()
    for item, day, _ in effective_positions:
        if item.duration_type_snapshot == DurationType.HOURLY:
            continue
        length = _get_block_length(
            item.duration_type_snapshot,
            item.duration_days_snapshot,
            item.duration_nights_snapshot,
        )
        end_day = day + length - 1
        if end_day > trip_planner.total_days:
            raise ValidationError(
                detail=f"day_number must be between 1 and {trip_planner.total_days}.",
                code="invalid_day_number"
            )
        for d in range(day, end_day + 1):
            if d in blocked_days:
                raise ValidationError(
                    detail="Selected day range is blocked by existing experiences.",
                    code="day_blocked"
                )
            blocked_days.add(d)

    # Hourly items cannot be on blocked days
    for item, day, _ in effective_positions:
        if item.duration_type_snapshot == DurationType.HOURLY and day in blocked_days:
            raise ValidationError(
                detail="Hourly experience cannot be placed on a blocked day.",
                code="day_blocked"
            )

def _calculate_estimated_cost(trip_planner: TripPlanner) -> Decimal:
    """
    Calcuate estimated cost from item snapshots.

    Formula: sum(price_snapshot) * travellers_count
    """

    from django.db.models import Sum

    total = _active_items(trip_planner).aggregate(
        total=Sum('price_snapshot')
    )['total'] or Decimal("0.00")

    return total * trip_planner.travellers_count


def _recalculate_cost(trip_planner: TripPlanner) -> None:
    """
    Recalculate and save estimated_cost on a trip plan.
    Called after adding/removing items.
    """
    trip_planner.estimated_cost = _calculate_estimated_cost(trip_planner)
    trip_planner.save(update_fields=['estimated_cost', 'updated_at'])


def _refresh_cover_image(trip_planner: TripPlanner) -> None:
    first_item = (
        _active_items(trip_planner)
        .select_related('listing')
        .prefetch_related('listing__images')
        .order_by('day_number', 'order')
        .first()
    )
    cover_image = ""
    if first_item:
        primary_image = first_item.listing.images.filter(is_primary=True).first()
        if primary_image is None:
            primary_image = first_item.listing.images.first()
        if primary_image:
            image_file = primary_image.thumbnail if primary_image.thumbnail else primary_image.image
            cover_image = image_file.url if image_file else ""

    if trip_planner.cover_image != cover_image:
        trip_planner.cover_image = cover_image
        trip_planner.save(update_fields=['cover_image', 'updated_at'])


def _determine_plan_status(trip_planner: TripPlanner) -> str | None:
    if trip_planner.status not in [TripStatus.PLANNING, TripStatus.PARTIALLY_BOOKED, TripStatus.BOOKED]:
        return None

    active_items = _active_items(trip_planner)
    total_items = active_items.count()
    booked_items = active_items.filter(booked_at__isnull=False).count()

    if total_items == 0 or booked_items == 0:
        return TripStatus.PLANNING
    if booked_items == total_items:
        return TripStatus.BOOKED
    return TripStatus.PARTIALLY_BOOKED


def _sync_plan_status(trip_planner: TripPlanner) -> None:
    new_status = _determine_plan_status(trip_planner)
    if new_status and trip_planner.status != new_status:
        trip_planner.status = new_status
        trip_planner.save(update_fields=['status', 'updated_at'])


def _removal_message_suffix(removal_reason: str) -> str:
    if removal_reason == TripPlannerItemRemovalReason.ADMIN_DEACTIVATED_LISTING:
        return "the listing is no longer available"
    return "the host deleted it"


def update_plan_status_from_booking(trip_plan_id: int) -> None:
    """
    Called by booking_service after a booking is confirmed to sync the
    TripPlanner status.
    - All items booked → BOOKED
    - Some items booked → PARTIALLY_BOOKED
    """
    try:
        plan = TripPlanner.objects.get(pk=trip_plan_id)
    except TripPlanner.DoesNotExist:
        return

    _sync_plan_status(plan)
