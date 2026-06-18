from celery import shared_task
from .services.booking_service import expire_stale_bookings


@shared_task(
    name="bookings.tasks.expire_stale_bookings_task",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def expire_stale_bookings_task(self):
    """
    Run every minute via Celery beat.

    Expires pending_payment bookings whose expires_at has passed.
    """
    try:
        count = expire_stale_bookings()
        return {"expired": count}
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(
    name="bookings.tasks.send_host_booking_notification_email_task",
    bind=True,
    max_retries=3,
)
def send_host_booking_notification_email_task(self, booking_id):
    """
    Send a new booking notification to all hosts involved in a booking.

    Groups BookingItems by host and sends one email per distinct host
    containing only their items. A booking across two hosts produces
    two separate notification emails.

    Args:
        booking_id: The Booking primary key.
    """
    from collections import defaultdict
    from .models import Booking
    from .emails import send_host_booking_notification_mail

    try:
        booking = Booking.objects.select_related("traveller").get(pk=booking_id)
        items = booking.items.select_related(
            "listing__host__user",
            "package__host__user",
        ).all()

        host_items = defaultdict(list)
        for item in items:
            if item.listing_id:
                host_user = item.listing.host.user
                host_items[host_user].append(item)
            elif item.package_id:
                host_user = item.package.host.user
                host_items[host_user].append(item)

        for host_user, host_booking_items in host_items.items():
            send_host_booking_notification_mail(booking, host_user, host_booking_items)

        return f"Host notification(s) sent for booking {booking.reference}"

    except Booking.DoesNotExist:
        return f"Booking {booking_id} not found"

    except Exception as exc:
        raise self.retry(exc=exc, countdown=5 * (2 ** self.request.retries))


@shared_task(
    name="bookings.tasks.send_booking_confirmation_email_task",
    bind=True,
    max_retries=3,
)
def send_booking_confirmation_email_task(self, booking_id):
    """
    Send booking confirmation email after a payment succeeds.

    Args:
        booking_id: The Booking primary key.

    Retries up to 3 times with exponential backoff on failure.
    """
    from .models import Booking
    from .emails import send_booking_confirmation_mail

    try:
        booking = Booking.objects.select_related("traveller").get(pk=booking_id)
        send_booking_confirmation_mail(booking)
        return f"Booking confirmation email sent to {booking.traveller.email} for {booking.reference}"

    except Booking.DoesNotExist:
        return f"Booking {booking_id} not found"

    except Exception as exc:
        raise self.retry(exc=exc, countdown=5 * (2 ** self.request.retries))


@shared_task(
    name="bookings.tasks.send_booking_cancelled_email_task",
    bind=True,
    max_retries=3,
)
def send_booking_cancelled_email_task(self, booking_id):
    """
    Notify the traveller that their booking was cancelled or expired.

    The reason_text is derived from the booking's current status and
    cancellation_reason field so the task is self-contained.

    Args:
        booking_id: The Booking primary key.
    """
    from .models import Booking, BookingStatus, CancellationReason
    from .emails import send_booking_cancelled_mail

    _REASON_MESSAGES = {
        CancellationReason.TRAVELLER_REQUEST: "You cancelled this booking.",
        CancellationReason.HOST_UNAVAILABLE: "The host is no longer available for this booking.",
        CancellationReason.PAYMENT_FAILED: "Payment could not be processed.",
        CancellationReason.PAYMENT_REFUNDED: "Your payment was refunded.",
        CancellationReason.PAYMENT_CANCELLED: "Your payment was cancelled.",
        CancellationReason.ADMIN_ACTION: "This booking was cancelled by the platform.",
        CancellationReason.OTHER: "This booking was cancelled.",
    }

    try:
        booking = Booking.objects.select_related("traveller").get(pk=booking_id)

        if booking.status == BookingStatus.EXPIRED:
            reason_text = "Your payment window expired — the slot was not held beyond the required time."
        else:
            reason_text = _REASON_MESSAGES.get(
                booking.cancellation_reason,
                "This booking was cancelled.",
            )

        send_booking_cancelled_mail(booking, reason_text)
        return f"Cancellation email sent to {booking.traveller.email} for {booking.reference}"

    except Booking.DoesNotExist:
        return f"Booking {booking_id} not found"

    except Exception as exc:
        raise self.retry(exc=exc, countdown=5 * (2 ** self.request.retries))


@shared_task(
    name="bookings.tasks.send_host_booking_cancelled_email_task",
    bind=True,
    max_retries=3,
)
def send_host_booking_cancelled_email_task(self, booking_id):
    """
    Notify all hosts involved in a booking that it has been cancelled.

    Only dispatched when a previously CONFIRMED booking is cancelled,
    since hosts were never informed about pending_payment bookings.

    Args:
        booking_id: The Booking primary key.
    """
    from collections import defaultdict
    from .models import Booking, CancellationReason
    from .emails import send_host_booking_cancelled_mail

    _REASON_MESSAGES = {
        CancellationReason.TRAVELLER_REQUEST: "The traveller cancelled this booking.",
        CancellationReason.HOST_UNAVAILABLE: "The host marked themselves unavailable.",
        CancellationReason.PAYMENT_REFUNDED: "The payment was refunded.",
        CancellationReason.PAYMENT_CANCELLED: "The payment was cancelled.",
        CancellationReason.ADMIN_ACTION: "This booking was cancelled by the platform.",
        CancellationReason.OTHER: "This booking was cancelled.",
    }

    try:
        booking = Booking.objects.select_related("traveller").get(pk=booking_id)
        items = booking.items.select_related(
            "listing__host__user",
            "package__host__user",
        ).all()

        reason_text = _REASON_MESSAGES.get(
            booking.cancellation_reason,
            "This booking was cancelled.",
        )

        host_items = defaultdict(list)
        for item in items:
            if item.listing_id:
                host_user = item.listing.host.user
                host_items[host_user].append(item)
            elif item.package_id:
                host_user = item.package.host.user
                host_items[host_user].append(item)

        for host_user, host_booking_items in host_items.items():
            send_host_booking_cancelled_mail(booking, host_user, host_booking_items, reason_text)

        return f"Host cancellation notification(s) sent for booking {booking.reference}"

    except Booking.DoesNotExist:
        return f"Booking {booking_id} not found"

    except Exception as exc:
        raise self.retry(exc=exc, countdown=5 * (2 ** self.request.retries))
