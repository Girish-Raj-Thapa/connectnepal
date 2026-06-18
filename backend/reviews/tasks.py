from celery import shared_task


@shared_task(
    name="reviews.tasks.send_host_review_notification_task",
    bind=True,
    max_retries=3,
)
def send_host_review_notification_task(self, review_id):
    """
    Notify the host that a new review has been posted on their listing or package.

    Args:
        review_id: The Review primary key.
    """
    from .models import Review
    from .emails import send_host_review_notification_mail

    try:
        review = Review.objects.select_related(
            "traveller",
            "booking_item",
            "listing__host__user",
            "package__host__user",
        ).get(pk=review_id)

        if review.listing_id:
            host_user = review.listing.host.user
        else:
            host_user = review.package.host.user

        send_host_review_notification_mail(review, host_user)
        return f"Review notification sent to {host_user.email} for review {review_id}"

    except Review.DoesNotExist:
        return f"Review {review_id} not found"

    except Exception as exc:
        raise self.retry(exc=exc, countdown=5 * (2 ** self.request.retries))
