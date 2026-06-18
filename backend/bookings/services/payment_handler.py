import logging
from collections import defaultdict
from decimal import Decimal

from django.db import transaction, IntegrityError
from django.db.models import F
from django.utils import timezone

from accounts.models import Account
from listings.models import Listing
from trip_planner.models import TripPlannerItem
from utils.exceptions import ServiceError
from ..models import (
    Booking, BookingItem,
    BookingStatusHistory, ProcessedPaymentEvent,
    BookingStatus, BookingItemStatus,
    PaymentStatus, CancellationReason,
)

logger = logging.getLogger(__name__)


@transaction.atomic
def handle_payment_update(
    booking_id: int,
    provider: str,
    payment_intent_ref: str,
    transaction_id: str,
    amount: Decimal,
    currency: str,
    status: str,           # PaymentStatus value from payments/ app
    event_id: str,
) -> Booking:
    """
    Called by the payments/ app (direct Python call, no HTTP).

    Idempotent: ProcessedPaymentEvent ensures each event_id is processed once.

    Accepted status values (normalized by payments/ app):
        - payment_pending | payment_succeeded | payment_failed
        - payment_refunded | payment_partially_refunded | payment_cancelled

    Steps:
        - Idempotency guard: if event_id already processed → return booking unchanged
        - Fetch booking (select_for_update)
        - Update payment reference fields on booking
        - Dispatch to appropriate handler based on status
        - Record ProcessedPaymentEvent
    """
    try:
        booking = Booking.objects.select_for_update().get(pk=booking_id)
    except Booking.DoesNotExist:
        raise ServiceError(
            f"Booking {booking_id} not found.",
            status_code=404,
        )

    # === Terminal state guard ========
    # CANCELLED and EXPIRED are hard stops — a late payment_succeeded on one of these is an error (e.g. gateway processed after hold expired).
    # Log it, record the event to stop retries, and return without mutation.
    HARD_TERMINAL_STATES = [
        BookingStatus.CANCELLED,
        BookingStatus.EXPIRED,
    ]

    # The ProcessedPaymentEvent unique constraint stops duplicate event_ids, but a gateway retry with a different event_id would slip through without
    # this guard — causing a double booking_count increment and duplicate history.
    if booking.status in [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] and status == PaymentStatus.PAYMENT_SUCCEEDED:
        logger.warning(
            "handle_payment_update: payment_succeeded for booking %s already in "
            "state %s (event %s). Skipping re-confirmation.",
            booking_id, booking.status, event_id,
        )
        try:
            ProcessedPaymentEvent.objects.create(event_id=event_id, booking=booking)
        except IntegrityError:
            pass
        return booking

    if booking.status in HARD_TERMINAL_STATES and status == PaymentStatus.PAYMENT_SUCCEEDED:
        logger.error(
            "handle_payment_update: late payment_succeeded for booking %s "
            "already in state %s (event %s). Manual review required.",
            booking_id, booking.status, event_id,
        )
        try:
            ProcessedPaymentEvent.objects.create(event_id=event_id, booking=booking)
        except IntegrityError:
            pass
        return booking

    if booking.status in HARD_TERMINAL_STATES and status == PaymentStatus.PAYMENT_PENDING:
        # No-op: pending notification after terminal state — ignore silently
        try:
            ProcessedPaymentEvent.objects.create(event_id=event_id, booking=booking)
        except IntegrityError:
            pass
        return booking

    # === Idempotency guard (inside atomic, after row lock) =====
    # Creating ProcessedPaymentEvent FIRST eliminates the check-then-act race:
    # if two workers arrive simultaneously, one will get IntegrityError and skip processing — the booking row lock serialises the state changes.
    try:
        ProcessedPaymentEvent.objects.create(event_id=event_id, booking=booking)
    except IntegrityError:
        # Already processed — return booking as-is without any mutations
        return booking

    now = timezone.now()

    # Update payment fields on booking
    booking.payment_status = status
    booking.payment_provider = provider
    booking.payment_intent_ref = payment_intent_ref
    booking.transaction_id = transaction_id

    if status == PaymentStatus.PAYMENT_SUCCEEDED:
        _handle_payment_succeeded(booking, amount, currency, now)

    elif status in (PaymentStatus.PAYMENT_REFUNDED, PaymentStatus.PAYMENT_CANCELLED):
        _handle_payment_cancelled_or_refunded(booking, status, now)

    elif status == PaymentStatus.PAYMENT_FAILED:
        booking.last_payment_error = f"Payment failed (event: {event_id})"
        booking.save(update_fields=[
            "payment_status", "payment_provider", "payment_intent_ref",
            "transaction_id", "last_payment_error",
        ])

    elif status == PaymentStatus.PAYMENT_PARTIALLY_REFUNDED:
        booking.paid_amount = amount
        booking.save(update_fields=[
            "payment_status", "payment_provider",
            "payment_intent_ref", "transaction_id", "paid_amount",
        ])

    else:
        # PAYMENT_PENDING — no state change needed
        booking.save(update_fields=[
            "payment_status", "payment_provider", "payment_intent_ref", "transaction_id",
        ])

    return booking


# Private helpers

def _handle_payment_succeeded(booking: Booking, amount: Decimal, currency: str, now) -> None:
    old_status = booking.status
    booking.status = BookingStatus.CONFIRMED
    booking.paid_amount = amount
    booking.currency = currency
    booking.paid_at = now
    booking.confirmed_at = now
    booking.save(update_fields=[
        "payment_status", "payment_provider", "payment_intent_ref",
        "transaction_id", "status", "paid_amount", "currency", "paid_at",
        "confirmed_at",
    ])

    BookingStatusHistory.objects.create(
        booking=booking,
        from_status=old_status,
        to_status=BookingStatus.CONFIRMED,
        note="Payment succeeded",
    )

    host_revenue = defaultdict(Decimal)

    items = booking.items.select_related(
        "hold", "listing", "listing__host", "package", "package__host", "trip_plan_item"
    ).all()

    for item in items:
        old_item_status = item.status
        item.status = BookingItemStatus.CONFIRMED
        item.save(update_fields=["status"])

        if item.hold:
            item.hold.release()

        if old_item_status != BookingItemStatus.CONFIRMED:
            if item.listing_id:
                Listing.objects.filter(pk=item.listing_id).update(
                    booking_count=F("booking_count") + 1
                )
                host_revenue[item.listing.host.user_id] += item.subtotal
            elif item.package_id:
                from packages.models import Package
                Package.objects.filter(pk=item.package_id).update(
                    booking_count=F("booking_count") + 1
                )
                host_revenue[item.package.host.user_id] += item.subtotal

        if item.trip_plan_item_id:
            TripPlannerItem.objects.filter(pk=item.trip_plan_item_id).update(booked_at=now)

        BookingStatusHistory.objects.create(
            booking=booking,
            booking_item=item,
            from_status=old_item_status,
            to_status=BookingItemStatus.CONFIRMED,
            note="Payment succeeded",
        )

    for host_user_id, revenue in host_revenue.items():
        Account.objects.filter(pk=host_user_id).update(
            total_revenue=F("total_revenue") + revenue
        )

    _suspend_overlimit_hosts(host_revenue)

    if booking.trip_plan_id:
        from trip_planner.services.trip_planner_service import update_plan_status_from_booking
        update_plan_status_from_booking(booking.trip_plan_id)

    # In-app notifications
    from notifications.services.notification_service import create_notification
    from notifications.services.notification_realtime_service import send_ws_notification
    from notifications.constants import NotificationType

    # Traveller notification
    traveller_notif = create_notification(
        recipient=booking.traveller,
        notification_type=NotificationType.BOOKING_CONFIRMED,
        title="Booking Confirmed",
        body=f"Your booking {booking.reference} has been confirmed. Thank you!",
        action_url=f"/bookings/{booking.reference}",
        metadata={"booking_id": booking.pk, "booking_reference": booking.reference},
        dedupe_key=f"booking_confirmed:{booking.pk}:{booking.traveller_id}",
    )

    # Host notifications (one per distinct host)
    host_notifications = []
    seen_hosts = set()
    for item in items:
        host_user_id = None
        if item.listing_id and item.listing and item.listing.host:
            host_user_id = item.listing.host.user_id
        elif item.package_id and item.package and item.package.host:
            host_user_id = item.package.host.user_id

        if host_user_id and host_user_id not in seen_hosts:
            seen_hosts.add(host_user_id)
            host_user = Account.objects.get(pk=host_user_id)
            host_notif = create_notification(
                recipient=host_user,
                actor=booking.traveller,
                notification_type=NotificationType.HOST_NEW_BOOKING,
                title="New Booking Received",
                body=f"You have a new booking {booking.reference} from {booking.traveller.full_name}.",
                action_url=f"/host/bookings/{booking.reference}",
                metadata={"booking_id": booking.pk, "booking_reference": booking.reference},
                dedupe_key=f"host_new_booking:{booking.pk}:{host_user_id}",
            )
            if host_notif:
                host_notifications.append(host_notif)

    #email + WebSocket
    from bookings.tasks import (
        send_booking_confirmation_email_task,
        send_host_booking_notification_email_task,
    )
    transaction.on_commit(
        lambda: send_booking_confirmation_email_task.delay(booking.pk)
    )
    transaction.on_commit(
        lambda: send_host_booking_notification_email_task.delay(booking.pk)
    )

    if traveller_notif:
        transaction.on_commit(lambda n=traveller_notif: send_ws_notification(n))
    for hn in host_notifications:
        transaction.on_commit(lambda n=hn: send_ws_notification(n))


def _handle_payment_cancelled_or_refunded(booking: Booking, status: str, now) -> None:
    # Map payment status to the semantically correct cancellation reason
    reason_map = {
        PaymentStatus.PAYMENT_REFUNDED: CancellationReason.PAYMENT_REFUNDED,
        PaymentStatus.PAYMENT_CANCELLED: CancellationReason.PAYMENT_CANCELLED,
    }
    reason = reason_map.get(status, CancellationReason.PAYMENT_FAILED)
    old_status = booking.status
    booking.status = BookingStatus.CANCELLED
    booking.cancelled_at = now
    booking.cancellation_reason = reason
    booking.save(update_fields=[
        "payment_status", "payment_provider", "payment_intent_ref",
        "transaction_id", "status", "cancelled_at", "cancellation_reason",
    ])

    BookingStatusHistory.objects.create(
        booking=booking,
        from_status=old_status,
        to_status=BookingStatus.CANCELLED,
        note=f"Payment status: {status}",
    )

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
            note=f"Payment status: {status}",
        )

    # Notify the traveller — booking was pending_payment so host was never informed
    from bookings.tasks import send_booking_cancelled_email_task
    transaction.on_commit(
        lambda: send_booking_cancelled_email_task.delay(booking.pk)
    )


def _suspend_overlimit_hosts(host_revenue: dict) -> None:
    """
    Called inside _handle_payment_succeeded after total_revenue has been incremented.

    For each host who received revenue in this payment, checks whether an unverified host has now hit or exceeded UNVERIFIED_HOST_TRANSACTION_LIMIT.
    If so:
      - Sets is_bookable=False on all their active listings and packages so no
        new travellers can book them (existing confirmed bookings are unaffected).
      - Sends the host an in-app notification prompting them to verify.

    Runs inside the same transaction.atomic as the payment confirmation.
    """
    from listings.constants import UNVERIFIED_HOST_TRANSACTION_LIMIT
    from packages.models import Package
    from notifications.services.notification_service import create_notification
    from notifications.services.notification_realtime_service import send_ws_notification
    from notifications.constants import NotificationType, NotificationPriority

    for host_user_id in host_revenue:
        acc = Account.objects.select_related("host_detail").get(pk=host_user_id)
        try:
            host_detail = acc.host_detail
        except Account.host_detail.RelatedObjectDoesNotExist:
            continue

        if host_detail.is_verified:
            continue

        if acc.total_revenue < UNVERIFIED_HOST_TRANSACTION_LIMIT:
            continue

        # Host is at or over the limit — suspend all active bookable listings/packages.
        suspended_listings = Listing.objects.filter(
            host=host_detail, is_active=True, is_bookable=True,
        ).update(is_bookable=False)

        suspended_packages = Package.objects.filter(
            host=host_detail, is_active=True, is_bookable=True,
        ).update(is_bookable=False)

        if suspended_listings == 0 and suspended_packages == 0:
            continue

        logger.warning(
            "Unverified host %s hit transaction limit (total_revenue=%s). "
            "Suspended %d listing(s) and %d package(s).",
            host_user_id, acc.total_revenue, suspended_listings, suspended_packages,
        )

        notification = create_notification(
            recipient=acc,
            notification_type=NotificationType.HOST_TRANSACTION_LIMIT_REACHED,
            title="Transaction Limit Reached — Listings Suspended",
            body=(
                f"You've reached the NPR {UNVERIFIED_HOST_TRANSACTION_LIMIT:,.0f} "
                "unverified transaction limit. Your active listings have been "
                "temporarily suspended. Complete account verification to reactivate them."
            ),
            action_url="/host/verification",
            metadata={"host_id": host_detail.pk},
            priority=NotificationPriority.HIGH,
            dedupe_key=f"host_transaction_limit:{host_detail.pk}",
        )
        if notification:
            transaction.on_commit(lambda n=notification: send_ws_notification(n))
