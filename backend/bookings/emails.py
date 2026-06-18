from decimal import Decimal

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags


def _item_title(item) -> str:
    snapshot = item.snapshot or {}
    return (
        snapshot.get("title")
        or snapshot.get("package_title")
        or (item.listing.title if item.listing_id and item.listing else "")
        or (item.package.title if item.package_id and item.package else "")
        or "Activity"
    )


def _item_destination(item) -> str:
    snapshot = item.snapshot or {}
    return snapshot.get("destination") or ""


def _item_host(item):
    if item.listing_id and item.listing:
        return item.listing.host
    if item.package_id and item.package:
        return item.package.host
    return None


def _serialize_email_items(items) -> list[dict]:
    serialized = []
    for item in items:
        serialized.append(
            {
                "title": _item_title(item),
                "destination": _item_destination(item),
                "start_date": item.start_date,
                "end_date": item.end_date,
                "start_time": item.start_time,
                "end_time": item.end_time,
                "traveller_count": item.traveller_count,
                "days": item.days,
                "nights": item.nights,
                "quoted_total": item.quoted_total,
            }
        )
    return serialized


def _build_host_sections(items) -> list[dict]:
    sections_by_host_id = {}

    for item in items:
        host = _item_host(item)
        if host is None:
            continue

        host_id = getattr(host, "pk", None) or getattr(host, "user_id", None)
        title = _item_title(item)

        if host_id not in sections_by_host_id:
            sections_by_host_id[host_id] = {
                "host": host,
                "titles": [],
            }

        if title not in sections_by_host_id[host_id]["titles"]:
            sections_by_host_id[host_id]["titles"].append(title)

    return [
        {
            "host": section["host"],
            "titles_display": ", ".join(section["titles"]),
        }
        for section in sections_by_host_id.values()
    ]


def _payment_method_label(booking) -> str:
    if booking.payment_provider:
        return booking.get_payment_provider_display()
    return "Unknown"


def send_host_booking_notification_mail(booking, host_user, items) -> None:
    """
    Send a new booking notification to one host after payment succeeds.

    Called once per distinct host involved in the booking. `items` contains
    only the BookingItems that belong to this host — not the full booking.

    Args:
        booking:   Booking instance (reference, traveller, paid_at).
        host_user: Account of the host receiving this email.
        items:     List of BookingItem instances belonging to this host.
    """
    items_list = list(items)
    email_items = _serialize_email_items(items_list)
    host_revenue_total = sum(
        (item.subtotal for item in items_list),
        start=Decimal("0.00"),
    )

    html_message = render_to_string('emails/host_booking_notification.html', {
        'user_email': host_user.email,
        'host_user': host_user,
        'booking': booking,
        'items': email_items,
        'host_revenue_total': host_revenue_total,
    })
    plain_message = strip_tags(html_message)

    email = EmailMultiAlternatives(
        subject=f"New Booking – {booking.reference} | ConnectNepal",
        body=plain_message,
        from_email=settings.EMAIL_HOST_USER,
        to=[host_user.email],
    )
    email.attach_alternative(html_message, 'text/html')
    email.send(fail_silently=False)


def send_booking_cancelled_mail(booking, reason_text: str) -> None:
    """
    Send booking cancellation / expiry notification to the traveller.

    Args:
        booking:     Booking instance (reference, traveller, items).
        reason_text: Human-readable reason string built by the caller.
    """
    user = booking.traveller
    items_list = list(
        booking.items.select_related("listing__host__user", "package__host__user").all()
    )

    html_message = render_to_string('emails/booking_cancelled.html', {
        'user_email': user.email,
        'user': user,
        'booking': booking,
        'items': _serialize_email_items(items_list),
        'reason_text': reason_text,
    })
    plain_message = strip_tags(html_message)

    email = EmailMultiAlternatives(
        subject=f"Booking {booking.status.capitalize()} – {booking.reference} | ConnectNepal",
        body=plain_message,
        from_email=settings.EMAIL_HOST_USER,
        to=[user.email],
    )
    email.attach_alternative(html_message, 'text/html')
    email.send(fail_silently=False)


def send_host_booking_cancelled_mail(booking, host_user, items, reason_text: str) -> None:
    """
    Send booking cancellation notification to one host.

    Only called when a previously CONFIRMED booking is cancelled so the host
    had already been notified about this booking.

    Args:
        booking:     Booking instance.
        host_user:   Account of the host receiving this email.
        items:       List of BookingItems belonging to this host.
        reason_text: Human-readable reason string built by the caller.
    """
    items_list = list(items)
    email_items = _serialize_email_items(items_list)

    html_message = render_to_string('emails/host_booking_cancelled.html', {
        'user_email': host_user.email,
        'host_user': host_user,
        'booking': booking,
        'items': email_items,
        'reason_text': reason_text,
    })
    plain_message = strip_tags(html_message)

    email = EmailMultiAlternatives(
        subject=f"Booking Cancelled – {booking.reference} | ConnectNepal",
        body=plain_message,
        from_email=settings.EMAIL_HOST_USER,
        to=[host_user.email],
    )
    email.attach_alternative(html_message, 'text/html')
    email.send(fail_silently=False)


def send_booking_confirmation_mail(booking):
    """
    Send booking confirmation email with full booking details to the traveller.

    Args:
        booking: Booking instance (items are fetched inside this function).
    """
    user = booking.traveller
    items_list = list(
        booking.items.select_related("listing__host__user", "package__host__user").all()
    )

    html_message = render_to_string('emails/booking_confirmation.html', {
        'user_email': user.email,
        'user': user,
        'booking': booking,
        'items': _serialize_email_items(items_list),
        'host_sections': _build_host_sections(items_list),
        'payment_method': _payment_method_label(booking),
    })

    plain_message = strip_tags(html_message)

    email = EmailMultiAlternatives(
        subject=f"Booking Confirmed – {booking.reference} | ConnectNepal",
        body=plain_message,
        from_email=settings.EMAIL_HOST_USER,
        to=[user.email],
    )

    email.attach_alternative(html_message, 'text/html')
    email.send(fail_silently=False)
