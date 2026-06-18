from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags


def _review_target_title(review) -> str:
    booking_item = getattr(review, "booking_item", None)
    snapshot = getattr(booking_item, "snapshot", None)
    if not isinstance(snapshot, dict):
        snapshot = {}

    if review.listing_id:
        return snapshot.get("title") or (review.listing.title if review.listing else "")
    return snapshot.get("package_title") or (review.package.title if review.package else "")


def send_host_review_notification_mail(review, host_user) -> None:
    """
    Notify a host that a new review has been posted on their listing or package.

    Args:
        review:    Review instance (traveller, rating, comment, listing/package).
        host_user: Account of the host receiving this notification.
    """
    target_title = _review_target_title(review)

    html_message = render_to_string('emails/host_review_notification.html', {
        'user_email': host_user.email,
        'host_user': host_user,
        'review': review,
        'target_title': target_title,
    })
    plain_message = strip_tags(html_message)

    email = EmailMultiAlternatives(
        subject=f'New Review on "{target_title}" | ConnectNepal',
        body=plain_message,
        from_email=settings.EMAIL_HOST_USER,
        to=[host_user.email],
    )
    email.attach_alternative(html_message, 'text/html')
    email.send(fail_silently=False)
