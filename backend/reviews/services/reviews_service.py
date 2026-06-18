import logging
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework import serializers as drf_serializers

from accounts.models import Account
from bookings.models import BookingItem, BookingItemStatus
from notifications.constants import NotificationPriority, NotificationType
from notifications.services.notification_realtime_service import send_ws_notification
from notifications.services.notification_service import create_notification
from utils.exceptions import ServiceError
from reviews.constants import REVIEW_WINDOW_DAYS
from reviews.models import (
    Review, ReviewReport, ReviewEvent,
    ReviewStatus, HostReplyStatus,
)

logger = logging.getLogger('reviews')


# Helpers

def _review_snapshot(review) -> dict:
    booking_item = getattr(review, "booking_item", None)
    snapshot = getattr(booking_item, "snapshot", None)
    return snapshot if isinstance(snapshot, dict) else {}


def _review_target_title(review) -> str:
    snapshot = _review_snapshot(review)
    if review.listing_id:
        return snapshot.get("title") or (review.listing.title if review.listing else "")
    if review.package_id:
        return snapshot.get("package_title") or (review.package.title if review.package else "")
    return ""

def find_eligible_booking_item(traveller, *, listing=None, package=None):
    """
    Find the first completed BookingItem that allows this traveller to review
    the given listing or package. Enforces 90-day review window.

    Returns:
        BookingItem

    Raises:
        rest_framework.serializers.ValidationError
    """
    qs = BookingItem.objects.filter(
        status=BookingItemStatus.COMPLETED,
        booking__traveller=traveller,
    )

    if listing is not None:
        qs = qs.filter(listing=listing)
    else:
        qs = qs.filter(package=package)

    item = qs.order_by('id').first()
    if item is None:
        target = "listing" if listing is not None else "package"
        raise drf_serializers.ValidationError(
            {target: f"You have no completed booking for this {target}."}
        )

    # 90-day window check
    if item.completed_at and timezone.now() > item.completed_at + timedelta(days=REVIEW_WINDOW_DAYS):
        raise drf_serializers.ValidationError(
            {"booking": f"The review window ({REVIEW_WINDOW_DAYS} days after completion) has closed."}
        )

    return item


def get_review_eligibility(booking_item) -> tuple[bool, str | None]:
    """
    Return (can_review, reason) for a BookingItem.

    can_review is True only when all conditions are met:
      - booking item is COMPLETED
      - no existing review, or existing review was user-deleted
      - within REVIEW_WINDOW_DAYS of completion

    reason is a human-readable string when can_review is False, else None.
    This is the single source of truth — call this from any layer instead of
    duplicating the 90-day window check or ReviewStatus import.
    """
    if booking_item.status != BookingItemStatus.COMPLETED:
        return False, "Booking item must be completed to leave a review."

    if hasattr(booking_item, 'review') and booking_item.review:
        if booking_item.review.status != ReviewStatus.USER_DELETED:
            return False, "You have already reviewed this booking item."

    if booking_item.completed_at:
        if timezone.now() > booking_item.completed_at + timedelta(days=REVIEW_WINDOW_DAYS):
            return False, f"The review window ({REVIEW_WINDOW_DAYS} days after completion) has closed."

    return True, None


def _recalculate_listing_rating(listing):
    """
    Recompute rating_average and rating_count from published reviews only.
    Must be called inside a transaction — acquires a row-level lock on the
    listing to prevent concurrent review publishes from racing and losing an
    update.
    """
    from listings.models import Listing as ListingModel
    listing = ListingModel.objects.select_for_update().get(pk=listing.pk)
    result = Review.objects.filter(
        listing=listing,
        status=ReviewStatus.PUBLISHED,
    ).aggregate(
        avg=Avg('rating'),
        cnt=Count('id'),
    )
    listing.rating_average = result['avg'] or 0
    listing.rating_count = result['cnt'] or 0
    listing.save(update_fields=['rating_average', 'rating_count'])


def _recalculate_package_rating(package):
    """
    Recompute rating_average and rating_count from published reviews only.
    Must be called inside a transaction — acquires a row-level lock on the
    package to prevent concurrent review publishes from racing and losing an
    update.
    """
    from packages.models import Package as PackageModel
    package = PackageModel.objects.select_for_update().get(pk=package.pk)
    result = Review.objects.filter(
        package=package,
        status=ReviewStatus.PUBLISHED,
    ).aggregate(
        avg=Avg('rating'),
        cnt=Count('id'),
    )
    package.rating_average = result['avg'] or 0
    package.rating_count = result['cnt'] or 0
    package.save(update_fields=['rating_average', 'rating_count'])


def _recalculate_target_rating(review):
    """
    Recalculate rating for whichever target (listing or package) the review belongs to.
    """
    if review.listing_id:
        _recalculate_listing_rating(review.listing)
    else:
        _recalculate_package_rating(review.package)


def _log_event(review, actor, actor_role, event_type, payload=None):
    """
    Create a ReviewEvent record.
    """
    ReviewEvent.objects.create(
        review=review,
        actor=actor,
        actor_role=actor_role,
        event_type=event_type,
        payload=payload or {},
    )


def _queue_ws_notification(notification):
    if notification:
        transaction.on_commit(lambda n=notification: send_ws_notification(n))


def _queue_ws_notifications(notifications):
    notifications = tuple(notification for notification in notifications if notification)
    if not notifications:
        return

    def _send_batch(items=notifications):
        for notification in items:
            send_ws_notification(notification)

    transaction.on_commit(_send_batch)


def _review_target_name(review):
    return _review_target_title(review) or "your experience"


def _notify_admins_review_reported(report):
    admins = Account.objects.filter(
        role=Account.Role.ADMIN,
        is_active=True,
    ).order_by("pk")
    if not admins.exists():
        return

    target_name = _review_target_name(report.review)
    target_label = (
        "host reply"
        if report.target_type == ReviewReport.TargetType.HOST_REPLY
        else "review"
    )
    body = (
        f'A {target_label} on "{target_name}" was reported and needs moderation review.'
    )

    notifications = []
    for admin in admins:
        notification = create_notification(
            recipient=admin,
            actor=report.reporter,
            notification_type=NotificationType.REVIEW_REPORTED,
            title="Review Reported",
            body=body,
            action_url="/admin/reviews",
            metadata={
                "review_id": report.review_id,
                "report_id": report.pk,
                "target_type": report.target_type,
                "reason": report.reason,
            },
            dedupe_key=f"review_report:{report.pk}:{admin.pk}",
            priority=NotificationPriority.HIGH,
        )
        notifications.append(notification)

    _queue_ws_notifications(notifications)


def _notify_traveller_review_moderated(review, old_status, new_status, admin_user):
    target_name = _review_target_name(review)

    if new_status == ReviewStatus.UNDER_REVIEW:
        title = "Review Under Review"
        body = f'Your review for "{target_name}" is now under moderation review.'
        priority = NotificationPriority.HIGH
    elif new_status == ReviewStatus.REMOVED:
        title = "Review Removed"
        body = f'Your review for "{target_name}" was removed by moderation.'
        priority = NotificationPriority.HIGH
    else:
        title = "Review Restored"
        body = f'Your review for "{target_name}" is visible again.'
        priority = NotificationPriority.NORMAL

    notification = create_notification(
        recipient=review.traveller,
        actor=admin_user,
        notification_type=NotificationType.REVIEW_MODERATED,
        title=title,
        body=body,
        action_url="/traveller/reviews",
        metadata={
            "review_id": review.pk,
            "old_status": old_status,
            "new_status": new_status,
        },
        priority=priority,
    )
    _queue_ws_notification(notification)


#  Core Review Operations

@transaction.atomic
def create_review(traveller, validated_data):
    """
    Create a new review and recalculate the target's average rating.

    validated_data must include: listing/package, booking_item, rating,
    comment, completion_date_snapshot.
    """
    # Lock booking item so duplicate-create requests cannot race.
    booking_item = BookingItem.objects.select_for_update().get(
        pk=validated_data["booking_item"].pk
    )
    validated_data["booking_item"] = booking_item

    existing_review = Review.objects.select_for_update().filter(
        booking_item=booking_item
    ).first()
    if existing_review is not None:
        if existing_review.status == ReviewStatus.USER_DELETED:
            # Preserve the old review row and its audit trail; only release the booking-item link so a new review can be created for the same trip.
            existing_review.booking_item = None
            existing_review.save(update_fields=['booking_item', 'updated_at'])
        else:
            raise drf_serializers.ValidationError(
                {"booking_item_id": "You have already reviewed this booking item."}
            )

    review = Review.objects.create(traveller=traveller, **validated_data)

    _recalculate_target_rating(review)

    _log_event(
        review, traveller, 'traveller',
        ReviewEvent.EventType.REVIEW_CREATED,
        {'rating': review.rating},
    )

    # In-app notification to host
    from notifications.services.notification_service import create_notification
    from notifications.services.notification_realtime_service import send_ws_notification
    from notifications.constants import NotificationType

    host_user = None
    target_name = _review_target_title(review)
    if review.listing_id and review.listing:
        host_user = review.listing.host.user if review.listing.host else None
    elif review.package_id and review.package:
        host_user = review.package.host.user if review.package.host else None

    if host_user:
        host_notif = create_notification(
            recipient=host_user,
            actor=traveller,
            notification_type=NotificationType.REVIEW_RECEIVED,
            title="New Review Received",
            body=f"{traveller.full_name} left a {review.rating}-star review on \"{target_name}\".",
            action_url=f"/host/reviews/{review.pk}",
            metadata={"review_id": review.pk, "rating": review.rating},
            dedupe_key=f"review_received:{review.pk}:{host_user.pk}",
        )
        if host_notif:
            transaction.on_commit(lambda n=host_notif: send_ws_notification(n))

    from reviews.tasks import send_host_review_notification_task
    transaction.on_commit(
        lambda: send_host_review_notification_task.delay(review.pk)
    )

    return review


@transaction.atomic
def update_review(review, validated_data, actor):
    """
    Edit a traveller's own review. Only rating and comment can change.
    Recalculates rating if rating changed.

    Args:
        review: Review instance (already permission-checked).
        validated_data: dict from ReviewEditSerializer.
        actor: Account (the traveller).

    Returns:
        Review — updated instance.
    """
    old_rating = review.rating
    payload = {}

    if 'rating' in validated_data:
        payload['old_rating'] = old_rating
        payload['new_rating'] = validated_data['rating']
        review.rating = validated_data['rating']

    if 'comment' in validated_data:
        payload['comment_changed'] = True
        review.comment = validated_data['comment']

    review.edited_at = timezone.now()
    review.edit_count += 1
    review.save(update_fields=['rating', 'comment', 'edited_at', 'edit_count', 'updated_at'])

    if review.rating != old_rating:
        _recalculate_target_rating(review)

    _log_event(review, actor, 'traveller', ReviewEvent.EventType.REVIEW_EDITED, payload)

    return review


@transaction.atomic
def soft_delete_review(review, actor):
    """
    Soft-delete a review. Sets status to user_deleted, recalculates rating.
    
    Does NOT remove the row — uniqueness constraint stays.
    """
    was_published = review.status == ReviewStatus.PUBLISHED

    review.status = ReviewStatus.USER_DELETED
    review.deleted_at = timezone.now()
    review.deleted_by_user = True
    review.save(update_fields=[
        'status', 'deleted_at', 'deleted_by_user', 'updated_at',
    ])

    if was_published:
        _recalculate_target_rating(review)

    _log_event(review, actor, 'traveller', ReviewEvent.EventType.REVIEW_DELETED)


# Host Reply

@transaction.atomic
def save_host_reply(review, reply_text, actor):
    """
    Save or overwrite the host's reply on a review.

    Review must be in published status.
    """
    if review.status != ReviewStatus.PUBLISHED:
        raise ServiceError(
            detail="You can only reply to published reviews.",
            code="review_not_published",
            status_code=400,
        )

    had_reply = review.host_reply_status == HostReplyStatus.PUBLISHED
    event_type = (
        ReviewEvent.EventType.HOST_REPLY_EDITED if had_reply
        else ReviewEvent.EventType.HOST_REPLY_CREATED
    )

    review.host_reply = reply_text
    review.host_reply_status = HostReplyStatus.PUBLISHED
    review.host_replied_at = timezone.now()
    review.save(update_fields=[
        'host_reply', 'host_reply_status', 'host_replied_at', 'updated_at',
    ])

    _log_event(review, actor, 'host', event_type)

    # In-app notification to traveller — only on new replies, not edits
    if not had_reply:
        notif = create_notification(
            recipient=review.traveller,
            actor=actor,
            notification_type=NotificationType.REVIEW_REPLY_RECEIVED,
            title="Host Replied to Your Review",
            body="The host replied to your review.",
            action_url=f"/reviews/{review.pk}",
            metadata={"review_id": review.pk},
            dedupe_key=f"review_reply:{review.pk}:{review.traveller_id}",
        )
        _queue_ws_notification(notif)

    return review


# Reporting

@transaction.atomic
def report_review(review, reporter, reason, details=''):
    """
    Report a review body. Enforces one open report per reporter per target.
    """
    if review.status not in (ReviewStatus.PUBLISHED, ReviewStatus.UNDER_REVIEW):
        raise ServiceError(
            detail="This review cannot be reported.",
            code="review_not_reportable",
            status_code=400,
        )

    if ReviewReport.objects.filter(
        review=review,
        reporter=reporter,
        target_type=ReviewReport.TargetType.REVIEW,
        status=ReviewReport.Status.OPEN,
    ).exists():
        raise ServiceError(
            detail="You have already reported this review.",
            code="duplicate_report",
            status_code=400,
        )

    try:
        report = ReviewReport.objects.create(
            review=review,
            reporter=reporter,
            target_type=ReviewReport.TargetType.REVIEW,
            reason=reason,
            details=details,
        )
    except IntegrityError:
        raise ServiceError(
            detail="You have already reported this review.",
            code="duplicate_report",
            status_code=400,
        )

    _log_event(review, reporter, 'host', ReviewEvent.EventType.REVIEW_REPORTED)
    _notify_admins_review_reported(report)

    return report


@transaction.atomic
def report_host_reply(review, reporter, reason, details=''):
    """
    Report a host reply. Enforces one open report per reporter per target.
    """
    if review.host_reply_status != HostReplyStatus.PUBLISHED:
        raise ServiceError(
            detail="This reply cannot be reported.",
            code="reply_not_reportable",
            status_code=400,
        )

    if ReviewReport.objects.filter(
        review=review,
        reporter=reporter,
        target_type=ReviewReport.TargetType.HOST_REPLY,
        status=ReviewReport.Status.OPEN,
    ).exists():
        raise ServiceError(
            detail="You have already reported this reply.",
            code="duplicate_report",
            status_code=400,
        )

    try:
        report = ReviewReport.objects.create(
            review=review,
            reporter=reporter,
            target_type=ReviewReport.TargetType.HOST_REPLY,
            reason=reason,
            details=details,
        )
    except IntegrityError:
        raise ServiceError(
            detail="You have already reported this reply.",
            code="duplicate_report",
            status_code=400,
        )

    _log_event(review, reporter, 'traveller', ReviewEvent.EventType.HOST_REPLY_REPORTED)
    _notify_admins_review_reported(report)

    return report


# Admin Moderation

# Status transition map: action -> new status
_REVIEW_ACTION_MAP = {
    'mark_published': ReviewStatus.PUBLISHED,
    'mark_under_review': ReviewStatus.UNDER_REVIEW,
    'mark_removed': ReviewStatus.REMOVED,
}

# Event type map
_REVIEW_EVENT_MAP = {
    'mark_published': ReviewEvent.EventType.REVIEW_RESTORED,
    'mark_under_review': ReviewEvent.EventType.REVIEW_MARKED_UNDER_REVIEW,
    'mark_removed': ReviewEvent.EventType.REVIEW_REMOVED,
}

# Statuses that count toward rating
_RATING_STATUSES = {ReviewStatus.PUBLISHED}


@transaction.atomic
def moderate_review(review, action, admin_user, note=''):
    """
    Admin moderation: change review status.
    
    Recalculates rating if the review crosses the published/non-published boundary.
    """
    new_status = _REVIEW_ACTION_MAP[action]
    old_status = review.status

    if old_status == new_status:
        raise ServiceError(
            detail=f"Review is already '{new_status}'.",
            code="no_status_change",
            status_code=400,
        )

    # Don't let admin moderate user_deleted reviews back to published
    if old_status == ReviewStatus.USER_DELETED and new_status == ReviewStatus.PUBLISHED:
        raise ServiceError(
            detail="Cannot republish a user-deleted review.",
            code="cannot_republish_deleted",
            status_code=400,
        )

    review.status = new_status
    review.moderated_at = timezone.now()
    review.moderated_by = admin_user
    review.moderation_reason = note
    review.save(update_fields=[
        'status', 'moderated_at', 'moderated_by', 'moderation_reason', 'updated_at',
    ])

    # Recalculate if crossing published boundary
    was_counted = old_status in _RATING_STATUSES
    now_counted = new_status in _RATING_STATUSES
    if was_counted != now_counted:
        _recalculate_target_rating(review)

    _log_event(
        review, admin_user, 'admin',
        _REVIEW_EVENT_MAP[action],
        {'old_status': old_status, 'new_status': new_status, 'note': note},
    )
    _notify_traveller_review_moderated(review, old_status, new_status, admin_user)

    return review


@transaction.atomic
def moderate_host_reply(review, action, admin_user, note=''):
    """
    Admin moderation: keep or remove host reply.
    """
    if action == 'remove_reply':
        if review.host_reply_status != HostReplyStatus.PUBLISHED:
            raise ServiceError(
                detail="No published reply to remove.",
                code="no_reply_to_remove",
                status_code=400,
            )
        review.host_reply_status = HostReplyStatus.REMOVED
        review.host_reply_moderated_at = timezone.now()
        review.host_reply_moderation_reason = note
        review.save(update_fields=[
            'host_reply_status', 'host_reply_moderated_at',
            'host_reply_moderation_reason', 'updated_at',
        ])

        _log_event(
            review, admin_user, 'admin',
            ReviewEvent.EventType.HOST_REPLY_REMOVED,
            {'note': note},
        )

    elif action == 'keep_reply':
        # Restore a removed reply
        if review.host_reply_status == HostReplyStatus.REMOVED:
            review.host_reply_status = HostReplyStatus.PUBLISHED
            review.host_reply_moderated_at = timezone.now()
            review.host_reply_moderation_reason = note
            review.save(update_fields=[
                'host_reply_status', 'host_reply_moderated_at',
                'host_reply_moderation_reason', 'updated_at',
            ])

    return review
