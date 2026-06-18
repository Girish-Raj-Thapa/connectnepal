from datetime import datetime, time

from django.db import transaction
from django.utils import timezone

from accounts.models import Account, HostDetail
from utils.exceptions import ServiceError
from ..models import (
    Booking, BookingItem,
    BookingStatusHistory,
    BookingStatus, BookingItemStatus, CancellationReason,
)


def _booking_item_title(item: BookingItem) -> str:
    snapshot = item.snapshot if isinstance(item.snapshot, dict) else {}
    return (
        snapshot.get("title")
        or snapshot.get("package_title")
        or (item.listing.title if item.listing_id and item.listing else "")
        or (item.package.title if item.package_id and item.package else "")
        or "Activity"
    )


def _item_completion_available_at(item: BookingItem):
    """
    Return the earliest timestamp when a host may mark the item complete.

    Rules:
    - HOURLY: after the scheduled end datetime if available.
    - FULL_DAY / MULTI_DAY: after the booked end date has fully elapsed
      in the current timezone.
    """
    if not item.end_date:
        return None

    if item.duration_type == "hourly" and item.end_time:
        completion_dt = datetime.combine(item.end_date, item.end_time)
    else:
        completion_dt = datetime.combine(item.end_date, time.max)

    if timezone.is_naive(completion_dt):
        return timezone.make_aware(
            completion_dt,
            timezone.get_current_timezone(),
        )
    return completion_dt


@transaction.atomic
def cancel_booking(user, booking_id: int, reason: str, note: str = "") -> Booking:
    """
    Cancel a booking. Traveller can cancel own pending_payment booking.

    Admin can cancel any booking that is not already terminal.

    Steps:
        - Fetch booking (select_for_update)
        - Permission check
        - Validate current status allows cancellation
        - Set booking → cancelled, all items → cancelled
        - Release all holds
        - Write history
    """
    try:
        booking = Booking.objects.select_for_update().get(pk=booking_id)
    except Booking.DoesNotExist:
        raise ServiceError("Booking not found.", status_code=404)

    is_admin = user.role == Account.Role.ADMIN
    is_owner = booking.traveller_id == user.id

    if not is_admin and not is_owner:
        raise ServiceError("Booking not found.", status_code=404)

    if not is_admin:
        # Traveller can only cancel pending_payment bookings
        if booking.status != BookingStatus.PENDING_PAYMENT:
            raise ServiceError(
                "Only pending_payment bookings can be cancelled by traveller.",
                code="invalid_status_transition",
                status_code=400,
            )
    else:
        # Admin cannot cancel already-terminal bookings
        if booking.status in [BookingStatus.CANCELLED, BookingStatus.EXPIRED]:
            raise ServiceError(
                f"Booking is already {booking.status}.",
                code="invalid_status_transition",
                status_code=400,
            )

    old_status = booking.status
    booking.status = BookingStatus.CANCELLED
    booking.cancelled_at = timezone.now()
    booking.cancellation_reason = reason
    booking.cancellation_note = note
    booking.cancelled_by = user
    booking.save(update_fields=[
        "status", "cancelled_at", "cancellation_reason",
        "cancellation_note", "cancelled_by",
    ])

    # Cancel all items + release holds
    items = booking.items.select_related("hold").all()
    for item in items:
        old_item_status = item.status
        item.status = BookingItemStatus.CANCELLED
        item.save(update_fields=["status"])
        if item.hold:
            item.hold.release()
        BookingStatusHistory.objects.create(
            booking=booking,
            booking_item=item,
            from_status=old_item_status,
            to_status=BookingItemStatus.CANCELLED,
            note=f"Booking cancelled: {note}",
            changed_by=user,
        )

    BookingStatusHistory.objects.create(
        booking=booking,
        from_status=old_status,
        to_status=BookingStatus.CANCELLED,
        note=note,
        changed_by=user,
    )

    # In-app notifications
    from notifications.services.notification_service import create_notification
    from notifications.services.notification_realtime_service import send_ws_notification
    from notifications.constants import NotificationType

    traveller_notif = create_notification(
        recipient=booking.traveller,
        notification_type=NotificationType.BOOKING_CANCELLED,
        title="Booking Cancelled",
        body=f"Your booking {booking.reference} has been cancelled.",
        action_url=f"/bookings/{booking.reference}",
        metadata={
            "booking_id": booking.pk,
            "booking_reference": booking.reference,
            "reason": reason,
        },
        dedupe_key=f"booking_cancelled:{booking.pk}:{booking.traveller_id}",
    )

    host_notifications = []
    if old_status == BookingStatus.CONFIRMED:
        seen_hosts = set()
        for item in items:
            host_user_id = None
            if item.listing_id:
                host_user_id = item.listing.host.user_id if item.listing and item.listing.host else None
            elif item.package_id:
                host_user_id = item.package.host.user_id if item.package and item.package.host else None

            if host_user_id and host_user_id not in seen_hosts:
                seen_hosts.add(host_user_id)
                host_user = Account.objects.get(pk=host_user_id)
                hn = create_notification(
                    recipient=host_user,
                    notification_type=NotificationType.HOST_BOOKING_CANCELLED,
                    title="Booking Cancelled",
                    body=f"Booking {booking.reference} has been cancelled.",
                    action_url=f"/host/bookings/{booking.reference}",
                    metadata={"booking_id": booking.pk, "booking_reference": booking.reference},
                    dedupe_key=f"host_booking_cancelled:{booking.pk}:{host_user_id}",
                )
                if hn:
                    host_notifications.append(hn)

    # Wrap existing email dispatch in on_commit
    from bookings.tasks import send_booking_cancelled_email_task
    transaction.on_commit(
        lambda: send_booking_cancelled_email_task.delay(booking.pk)
    )
    if old_status == BookingStatus.CONFIRMED:
        from bookings.tasks import send_host_booking_cancelled_email_task
        transaction.on_commit(
            lambda: send_host_booking_cancelled_email_task.delay(booking.pk)
        )

    # WebSocket push (after commit)
    if traveller_notif:
        transaction.on_commit(lambda n=traveller_notif: send_ws_notification(n))
    for hn in host_notifications:
        transaction.on_commit(lambda n=hn: send_ws_notification(n))

    return booking


@transaction.atomic
def host_mark_completed(host_user, booking_item_id: int) -> BookingItem:
    """
    Host marks one BookingItem as completed.

    Supports both listing-backed and package-backed booking items.
    The item must already have reached its scheduled completion point:
    hourly items after their end datetime, and full-day / multi-day items
    after the booked end date has elapsed.

    If all items in the parent Booking are now completed, the Booking is also
    marked completed.
    """
    try:
        host_detail = host_user.host_detail
    except HostDetail.DoesNotExist:
        raise ServiceError("Host profile not found.", status_code=403)

    try:
        item = (
            BookingItem.objects
            .select_related("booking")
            .select_for_update()
            .get(pk=booking_item_id)
        )
    except BookingItem.DoesNotExist:
        raise ServiceError("Booking item not found.", status_code=404)

    is_owned_by_host = False

    if item.listing_id and item.listing and item.listing.host_id == host_detail.pk:
        is_owned_by_host = True

    if item.package_id and item.package and item.package.host_id == host_detail.pk:
        is_owned_by_host = True

    if not is_owned_by_host:
        raise ServiceError("Booking item not found.", status_code=404)

    if item.status != BookingItemStatus.CONFIRMED:
        raise ServiceError(
            "Only confirmed items can be marked completed.",
            code="invalid_status_transition",
            status_code=400,
        )

    completion_available_at = _item_completion_available_at(item)
    now = timezone.now()
    if completion_available_at and now < completion_available_at:
        raise ServiceError(
            "This booking item cannot be marked completed before the scheduled experience ends.",
            code="completion_too_early",
            status_code=400,
        )

    old_status = item.status
    item.status = BookingItemStatus.COMPLETED
    item.completed_at = now
    item.save(update_fields=["status", "completed_at", "updated_at"])

    BookingStatusHistory.objects.create(
        booking=item.booking,
        booking_item=item,
        from_status=old_status,
        to_status=BookingItemStatus.COMPLETED,
        note="Marked completed by host",
        changed_by=host_user,
    )

    booking = Booking.objects.select_for_update().get(pk=item.booking_id)
    if booking.all_items_completed and booking.status != BookingStatus.COMPLETED:
        old_booking_status = booking.status
        booking.status = BookingStatus.COMPLETED
        booking.save(update_fields=["status", "updated_at"])
        BookingStatusHistory.objects.create(
            booking=booking,
            from_status=old_booking_status,
            to_status=BookingStatus.COMPLETED,
            note="All items completed",
            changed_by=host_user,
        )

    # In-app notification — traveller can now leave a review
    from notifications.services.notification_service import create_notification
    from notifications.services.notification_realtime_service import send_ws_notification
    from notifications.constants import NotificationType

    listing_or_package_name = _booking_item_title(item)

    notif = create_notification(
        recipient=booking.traveller,
        notification_type=NotificationType.BOOKING_COMPLETED,
        title="Experience Completed",
        body=f'Your experience "{listing_or_package_name}" is now complete. You can leave a review!',
        action_url=f"/bookings/{booking.reference}",
        metadata={
            "booking_item_id": item.pk,
            "booking_reference": booking.reference,
        },
        dedupe_key=f"booking_completed:{item.pk}:{booking.traveller_id}",
    )

    if notif:
        transaction.on_commit(lambda n=notif: send_ws_notification(n))

    return item


def expire_stale_bookings(now_override=None) -> int:
    """
    Batch-expire pending_payment bookings whose expires_at has passed.

    Called by Celery beat task and management command.

    Strategy: fetch IDs without lock → re-check individually with
    select_for_update(skip_locked=True) to avoid deadlocks.

    Returns: count of bookings expired.
    """
    now = now_override or timezone.now()
    stale_ids = list(
        Booking.objects.filter(
            status=BookingStatus.PENDING_PAYMENT,
            expires_at__lte=now,
        ).values_list("id", flat=True)
    )

    expired_count = 0
    for booking_id in stale_ids:
        try:
            with transaction.atomic():
                booking = Booking.objects.select_for_update(skip_locked=True).get(
                    pk=booking_id,
                    status=BookingStatus.PENDING_PAYMENT,
                    expires_at__lte=now,
                )
                _expire_single_booking(booking, now)
                expired_count += 1
        except Booking.DoesNotExist:
            pass  # Already handled by another worker or changed status

    return expired_count


# Private helpers

def _expire_single_booking(booking: Booking, now) -> None:
    """Expires one stale booking. Called inside its own atomic block."""
    old_status = booking.status
    booking.status = BookingStatus.EXPIRED
    booking.save(update_fields=["status"])

    BookingStatusHistory.objects.create(
        booking=booking,
        from_status=old_status,
        to_status=BookingStatus.EXPIRED,
        note="Payment window expired",
    )

    items = booking.items.select_related("hold").all()
    for item in items:
        old_item_status = item.status
        item.status = BookingItemStatus.EXPIRED
        item.save(update_fields=["status"])
        if item.hold:
            item.hold.release()
        BookingStatusHistory.objects.create(
            booking=booking,
            booking_item=item,
            from_status=old_item_status,
            to_status=BookingItemStatus.EXPIRED,
            note="Payment window expired",
        )

    # In-app notification
    from notifications.services.notification_service import create_notification
    from notifications.services.notification_realtime_service import send_ws_notification
    from notifications.constants import NotificationType

    traveller_notif = create_notification(
        recipient=booking.traveller,
        notification_type=NotificationType.BOOKING_EXPIRED,
        title="Booking Expired",
        body=f"Your booking {booking.reference} has expired due to incomplete payment.",
        action_url=f"/bookings/{booking.reference}",
        metadata={"booking_id": booking.pk, "booking_reference": booking.reference},
        dedupe_key=f"booking_expired:{booking.pk}:{booking.traveller_id}",
    )

    from bookings.tasks import send_booking_cancelled_email_task
    transaction.on_commit(
        lambda: send_booking_cancelled_email_task.delay(booking.pk)
    )
    if traveller_notif:
        transaction.on_commit(lambda n=traveller_notif: send_ws_notification(n))
