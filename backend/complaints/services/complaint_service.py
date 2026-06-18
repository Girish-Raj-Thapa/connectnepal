import logging
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from bookings.models import BookingItem, BookingItemStatus
from notifications.constants import NotificationPriority, NotificationType
from notifications.services.notification_realtime_service import send_ws_notification
from notifications.services.notification_service import create_notification
from utils.exceptions import ServiceError

from complaints.models import (
    Complaint, ComplaintEvidence, ComplaintResponse, ComplaintEvent,
    ComplaintCategory, ComplaintSeverity, ComplaintStatus,
    ComplaintOutcome, ComplaintEventType, FiledByRole,
    REPORTING_WINDOW_DAYS, INITIAL_SEVERITY,
    CATEGORIES_REQUIRING_EVIDENCE, SENSITIVE_CATEGORIES,
    ALLOWED_TRANSITIONS, RESOLVED_OUTCOMES, REJECTED_OUTCOMES,
    ACTIVE_COMPLAINT_STATUSES,
)

logger = logging.getLogger('complaints')

COMPLAINANT_STATUS_NOTIFICATION_STATUSES = {
    ComplaintStatus.TRIAGED,
    ComplaintStatus.NEEDS_MORE_INFO,
    ComplaintStatus.AWAITING_RESPONDENT,
    ComplaintStatus.UNDER_REVIEW,
    ComplaintStatus.ESCALATED,
    ComplaintStatus.RESOLVED,
    ComplaintStatus.REJECTED,
    ComplaintStatus.CLOSED,
}

RESPONDENT_STATUS_NOTIFICATION_STATUSES = {
    ComplaintStatus.ESCALATED,
    ComplaintStatus.RESOLVED,
    ComplaintStatus.REJECTED,
    ComplaintStatus.CLOSED,
}


# HELPER FUNCTIONS

def _log_event(complaint, actor, actor_role, event_type, payload=None):
    ComplaintEvent.objects.create(
        complaint=complaint,
        event_type=event_type,
        actor=actor,
        actor_role=actor_role,
        payload=payload or {},
    )


def _queue_ws_notification(notification):
    if notification:
        transaction.on_commit(lambda n=notification: send_ws_notification(n))


def _complaint_action_url(complaint, recipient):
    if recipient.pk == complaint.filed_by_id:
        if complaint.filed_by_role == FiledByRole.TRAVELLER:
            return f"/complaints/{complaint.pk}"
        return f"/host/complaints/{complaint.pk}"

    if recipient.pk == complaint.complaint_against_user_id:
        if complaint.filed_by_role == FiledByRole.TRAVELLER:
            return f"/host/complaints/received/{complaint.pk}"
        return f"/complaints/received/{complaint.pk}"

    return ""


def _status_label(status_value):
    return ComplaintStatus(status_value).label


def _complaint_status_message(complaint, recipient, new_status):
    if (
        new_status == ComplaintStatus.NEEDS_MORE_INFO
        and recipient.pk == complaint.filed_by_id
    ):
        return (
            "More Information Requested",
            (
                f"We need more information to continue reviewing complaint "
                f"#{complaint.pk}."
            ),
        )

    if new_status == ComplaintStatus.ESCALATED:
        return (
            "Complaint Escalated",
            (
                f"Complaint #{complaint.pk} has been escalated for additional "
                "admin review."
            ),
        )

    label = _status_label(new_status)
    if recipient.pk == complaint.filed_by_id:
        return (
            "Complaint Status Updated",
            f"Your complaint #{complaint.pk} status changed to {label}.",
        )

    return (
        "Complaint Status Updated",
        f"Complaint #{complaint.pk} status changed to {label}.",
    )


def _notify_complaint_status_change(complaint, old_status, new_status):
    metadata = {
        "complaint_id": complaint.pk,
        "old_status": old_status,
        "new_status": new_status,
    }

    if new_status in COMPLAINANT_STATUS_NOTIFICATION_STATUSES:
        title, body = _complaint_status_message(
            complaint,
            complaint.filed_by,
            new_status,
        )
        complainant_notif = create_notification(
            recipient=complaint.filed_by,
            notification_type=NotificationType.COMPLAINT_STATUS_CHANGED,
            title=title,
            body=body,
            action_url=_complaint_action_url(complaint, complaint.filed_by),
            metadata=metadata,
            dedupe_key=f"complaint_status:{complaint.pk}:{new_status}:{complaint.filed_by_id}",
        )
        _queue_ws_notification(complainant_notif)

    if (
        complaint.complaint_against_user_id
        and new_status in RESPONDENT_STATUS_NOTIFICATION_STATUSES
    ):
        title, body = _complaint_status_message(
            complaint,
            complaint.complaint_against_user,
            new_status,
        )
        respondent_notif = create_notification(
            recipient=complaint.complaint_against_user,
            notification_type=NotificationType.COMPLAINT_STATUS_CHANGED,
            title=title,
            body=body,
            action_url=_complaint_action_url(
                complaint, complaint.complaint_against_user,
            ),
            metadata=metadata,
            dedupe_key=(
                f"complaint_status:{complaint.pk}:{new_status}:"
                f"{complaint.complaint_against_user_id}"
            ),
        )
        _queue_ws_notification(respondent_notif)


def _notify_respondent_complaint_received(complaint):
    if not complaint.complaint_against_user_id:
        return

    notification = create_notification(
        recipient=complaint.complaint_against_user,
        notification_type=NotificationType.COMPLAINT_RECEIVED,
        title="Complaint Requires Your Response",
        body=(
            f"A complaint #{complaint.pk} has been shared with you. "
            "Please review it and respond."
        ),
        action_url=_complaint_action_url(complaint, complaint.complaint_against_user),
        metadata={
            "complaint_id": complaint.pk,
            "new_status": complaint.status,
        },
        dedupe_key=(
            f"complaint_received:{complaint.pk}:{complaint.complaint_against_user_id}"
        ),
        priority=NotificationPriority.HIGH,
    )
    _queue_ws_notification(notification)


def _transition_status(complaint, new_status, actor, actor_role, event_type, payload=None):
    """
    Enforces the ALLOWED_TRANSITIONS matrix.
    Updates complaint.status and logs a ComplaintEvent.

    Raises ServiceError if the transition is not allowed.
    """
    old_status = complaint.status
    allowed = ALLOWED_TRANSITIONS.get(old_status, set())
    if new_status not in allowed:
        raise ServiceError(
            detail=f"Cannot transition from '{old_status}' to '{new_status}.'",
            code="invalid_status_transition",
        )
    complaint.status = new_status
    update_fields = ['status', 'updated_at']

    if new_status == ComplaintStatus.TRIAGED and not complaint.triaged_at:
        complaint.triaged_at = timezone.now()
        update_fields.append('triaged_at')

    if new_status in (ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED):
        complaint.resolved_at = timezone.now()
        update_fields.append('resolved_at')

    complaint.save(update_fields=update_fields)

    event_payload = {'old_status': old_status, 'new_status': new_status}
    if payload:
        event_payload.update(payload)

    _log_event(complaint, actor, actor_role, event_type, event_payload)

    logger.info(
        "Complaint #%d: %s → %s (by %s)",
        complaint.pk, old_status, new_status, actor.email if actor else "system",
    )

    _notify_complaint_status_change(complaint, old_status, new_status)


def _infer_respondent(booking_item, booking, filed_by_role):
    """
    Auto-infer complaint_against_user from booking context.
        If traveller filed → respondent is the host's Account

        If host filed → respondent is the booking's traveller
    """
    if filed_by_role == FiledByRole.TRAVELLER:
        # The host who owns the listing or package
        if booking_item.listing_id and booking_item.listing:
            return booking_item.listing.host.user
        if booking_item.package_id and booking_item.package:
            return booking_item.package.host.user
        return None
    else:
        # Host filed -> respondent is the booking traveller
        return booking.traveller


# PUBLIC: CREATE COMPLAINT 

@transaction.atomic
def create_complaint(user, validated_data):
    """
    Create a new complaint.

    validated_data must contain:
      - booking_item  (BookingItem instance, already ownership-validated by serializer)
      - category      (ComplaintCategory value)
      - title         (str)
      - description   (str)
      - filed_by_role (FiledByRole value, set by serializer)

    Auto-inferred by this function:
      - booking (from booking_item.booking)
      - listing / package (from booking_item)
      - complaint_against_user
      - severity (from INITIAL_SEVERITY mapping)
      - is_sensitive
      - requires_evidence

    Returns Complaint instance.
    """
    booking_item = validated_data['booking_item']
    booking = booking_item.booking
    category = validated_data['category']
    filed_by_role = validated_data['filed_by_role']

    # Guard: one active complaint per booking item per user
    if Complaint.objects.filter(
        booking_item=booking_item,
        filed_by=user,
        status__in=ACTIVE_COMPLAINT_STATUSES,
    ).exists():
        raise ServiceError(
            detail="You already have an active complaint for this booking item.",
            code="duplicate_complaint",
        )

    # Auto-infer
    listing = booking_item.listing if booking_item.listing_id else None
    package = booking_item.package if booking_item.package_id else None
    respondent = _infer_respondent(booking_item, booking, filed_by_role)

    if respondent is None:
        raise ServiceError(
            detail="Could not determine the respondent for this complaint. "
                   "The booking may have incomplete ownership data.",
            code="respondent_not_found",
        )
    
    severity = INITIAL_SEVERITY.get(category, ComplaintSeverity.MEDIUM)
    is_sensitive = category in SENSITIVE_CATEGORIES
    requires_evidence = category in CATEGORIES_REQUIRING_EVIDENCE

    try:
        complaint = Complaint.objects.create(
            booking_item=booking_item,
            booking=booking,
            filed_by=user,
            filed_by_role=filed_by_role,
            listing=listing,
            package=package,
            complaint_against_user=respondent,
            category=category,
            title=validated_data['title'],
            description=validated_data['description'],
            severity=severity,
            status=ComplaintStatus.SUBMITTED,
            is_sensitive=is_sensitive,
            requires_evidence=requires_evidence,
        )
    except IntegrityError:
        raise ServiceError(
            detail="You already have an active complaint for this booking item.",
            code="duplicate_complaint",
            status_code=409,
        )

    _log_event(
        complaint, user, filed_by_role,
        ComplaintEventType.COMPLAINT_SUBMITTED,
        {
            'category': category,
            'severity': severity,
            'is_sensitive': is_sensitive,
            'requires_evidence': requires_evidence,
        },
    )

    logger.info(
        "Complaint #%d created by %s (role=%s, category=%s, severity=%s)",
        complaint.pk, user.email, filed_by_role, category, severity,
    )

    return complaint


# PUBLIC: EVIDENCE

@transaction.atomic
def submit_evidence(complaint, user, file_obj, description=''):
    """
    Upload an evidence file to a complaint.

    If user is the complainant and evidence was required, flip the flag.
    """
    evidence = ComplaintEvidence.objects.create(
        complaint=complaint,
        file=file_obj,
        file_name=file_obj.name,
        file_size=file_obj.size,
        file_type=getattr(file_obj, 'content_type', 'application/octet-stream'),
        description=description,
        uploaded_by=user,
    )

    # if this is complainant evidence and evidence was required, mark submiteed
    if complaint.requires_evidence and user.id == complaint.filed_by_id:
        if not complaint.complainant_evidence_submitted:
            complaint.complainant_evidence_submitted = True
            complaint.save(update_fields=['complainant_evidence_submitted', 'updated_at'])
    
    actor_role = complaint.filed_by_role if user.id == complaint.filed_by_id else 'respondent'

    _log_event(
        complaint, user, actor_role,
        ComplaintEventType.EVIDENCE_ADDED,
        {'evidence_id': evidence.pk, 'file_name': evidence.file_name, 'uploader': actor_role},
    )

    return evidence


# PUBLIC RESPONDENT RESPONSE

@transaction.atomic
def submit_response(complaint, user, body):
    """
    Respondent submits their reply. Only allowed when status == AWAITING_RESPONDENT.
    Automatically transitions status to UNDER_REVIEW.

    Raises ServiceError if:
    - User is not the respondent
    - Status is not AWAITING_RESPONDENT
    - Response already exists
    """
    if complaint.complaint_against_user_id != user.id:
        raise ServiceError(
            detail="You are not the respondent for this complaint.",
            code="not_respondent",
            status_code=403,
        )
    
    if complaint.status != ComplaintStatus.AWAITING_RESPONDENT:
        raise ServiceError(
            detail="This complaint is not currently awaiting your response.",
            code="invalid_status",
        )
    
    # Check for existing response (OneToOneField enforces at DB level too)
    if hasattr(complaint, 'response') and complaint.response is not None:
        raise ServiceError(
            detail="You have already responded to this complaint.",
            code="duplicate_response",
        )
    
    response  = ComplaintResponse.objects.create(
        complaint=complaint,
        responded_by=user,
        body=body,
        is_visible_to_complainant=not complaint.is_sensitive,
    )

    # Determine respondent role
    if complaint.filed_by_role == FiledByRole.TRAVELLER:
        respondent_role = 'host'
    else:
        respondent_role = 'traveller'
    
    _log_event(
        complaint, user, respondent_role,
        ComplaintEventType.RESPONSE_RECEIVED,
        {'response_id': response.pk},
    )

    # Auto-transition to UNDER_REVIEW
    _transition_status(
        complaint, ComplaintStatus.UNDER_REVIEW,
        actor=None, actor_role='system',
        event_type=ComplaintEventType.REVIEW_STARTED,
    )

    return response


# PUBLIC: ADMIN MODERATION - STATUS TRANSITIONS 

@transaction.atomic 
def admin_triage(complaint, admin_user, note=''):
    """
    Admin triages a submitted complaint.
    """
    if complaint.requires_evidence and not complaint.complainant_evidence_submitted:
        raise ServiceError(
            detail="Complainant has not submitted required evidence. Request more info first.",
            code="evidence_missing",
        )
    
    payload = {'note': note} if note else {}

    _transition_status(
        complaint, ComplaintStatus.TRIAGED,
        actor=admin_user, actor_role='admin',
        event_type=ComplaintEventType.COMPLAINT_TRIAGED,
        payload=payload,
    )


@transaction.atomic
def admin_request_info(complaint, admin_user, note=''):
    """
    Admin requests more info from complainant.

    Valid from: SUBMITTED, TRIAGED.

    Target status: NEEDS_MORE_INFO.
    """
    _transition_status(
        complaint, ComplaintStatus.NEEDS_MORE_INFO,
        actor=admin_user, actor_role='admin',
        event_type=ComplaintEventType.MORE_INFO_REQUESTED,
        payload={'note': note} if note else {},
    )


@transaction.atomic
def admin_send_to_respondent(complaint, admin_user, summary_for_respondent=''):
    """
    Admin forwards complaint to respondent for their side of the story.

    If complaint is sensitive and admin provides a summary, it is saved.
    """
    if complaint.is_sensitive and not summary_for_respondent:
        raise ServiceError(
            detail="Sensitive complaints require an admin summary for the respondent.",
            code="summary_required",
        )

    if complaint.is_sensitive and summary_for_respondent:
        complaint.admin_summary_for_respondent = summary_for_respondent
        complaint.save(update_fields=['admin_summary_for_respondent', 'updated_at'])

    _transition_status(
        complaint, ComplaintStatus.AWAITING_RESPONDENT,
        actor=admin_user, actor_role='admin',
        event_type=ComplaintEventType.RESPONDENT_NOTIFIED,
    )
    _notify_respondent_complaint_received(complaint)


@transaction.atomic
def admin_begin_review(complaint, admin_user):
    """
    Admin begins review without sending to respondent.
    """
    _transition_status(
        complaint, ComplaintStatus.UNDER_REVIEW,
        actor=admin_user, actor_role='admin',
        event_type=ComplaintEventType.REVIEW_STARTED,
    )


@transaction.atomic
def admin_escalate(complaint, admin_user, note=''):
    """Admin escalates complaint."""
    _transition_status(
        complaint, ComplaintStatus.ESCALATED,
        actor=admin_user, actor_role='admin',
        event_type=ComplaintEventType.COMPLAINT_ESCALATED,
        payload={'note': note} if note else {},
    )


# PUBLIC: ADMIN - SEVERITY OVERRIDE 

@transaction.atomic
def admin_update_severity(complaint, admin_user, new_severity, reason=''):
    """
    Admin overrides the severity level.
    """
    old_severity = complaint.severity
    if old_severity == new_severity:
        raise ServiceError(detail="Severity is already set to this value.", code="no_change")
    
    complaint.severity = new_severity
    complaint.severity_overridden_by = admin_user
    complaint.severity_override_reason = reason
    complaint.save(update_fields=[
        'severity', 'severity_overridden_by', 'severity_override_reason', 'updated_at',
    ])

    _log_event(
        complaint, admin_user, 'admin',
        ComplaintEventType.SEVERITY_UPDATED,
        {'old_severity': old_severity, 'new_severity': new_severity, 'reason': reason},
    )


# PUBLIC: ADMIN - RECORD OUTCOME

@transaction.atomic
def admin_record_outcome(complaint, admin_user, outcome, resolution_note, protective_action=''):
    """
    Record final outcome. Determines whether complaint becomes RESOLVED or REJECTED.

    outcome in RESOLVED_OUTCOMES → status = RESOLVED
    outcome in REJECTED_OUTCOMES → status = REJECTED

    Validates the derived target status against ALLOWED_TRANSITIONS so that
    impossible transitions (e.g. SUBMITTED → RESOLVED) are rejected.

    Raises ServiceError if:
    - outcome is unknown
    - the transition from current status to outcome-derived status is not
      in the ALLOWED_TRANSITIONS matrix
    """
    # Determine the target status from the outcome
    if outcome in RESOLVED_OUTCOMES:
        new_status = ComplaintStatus.RESOLVED
    elif outcome in REJECTED_OUTCOMES:
        new_status = ComplaintStatus.REJECTED
    else:
        raise ServiceError(detail=f"Unknown outcome: {outcome}", code="invalid_outcome")

    # Validate agains ALLOWED_TRANSITIONS - single source of truth 
    old_status = complaint.status
    allowed = ALLOWED_TRANSITIONS.get(old_status, set())
    if new_status not in allowed:
        raise ServiceError(
            detail=(
                f"Cannot record outcome '{outcome}' (→ {new_status}) "
                f"from current status '{old_status}'."
            ),
            code="invalid_status_transition",
        )
    
    # apply outcome fields
    complaint.status = new_status
    complaint.outcome = outcome
    complaint.outcome_recorded_by = admin_user
    complaint.outcome_recorded_at = timezone.now()
    complaint.resolution_note = resolution_note
    complaint.resolved_at = timezone.now()

    update_fields = [
        'status', 'outcome', 'outcome_recorded_by', 'outcome_recorded_at',
        'resolution_note', 'resolved_at', 'updated_at',
    ]

    if protective_action:
        complaint.protective_action = protective_action
        complaint.protective_action_recorded_at = timezone.now()
        update_fields += ['protective_action', 'protective_action_recorded_at']

    complaint.save(update_fields=update_fields)

    _log_event(
        complaint, admin_user, 'admin',
        ComplaintEventType.OUTCOME_RECORDED,
        {
            'old_status': old_status,
            'new_status': new_status,
            'outcome': outcome,
            'has_protective_action': bool(protective_action),
        },
    )

    if protective_action:
        _log_event(
            complaint, admin_user, 'admin',
            ComplaintEventType.PROTECTIVE_ACTION_RECORDED,
            {'action': protective_action},
        )

    logger.info(
        "Complaint #%d outcome: %s → status %s (by admin %s)",
        complaint.pk, outcome, new_status, admin_user.email,
    )

    _notify_complaint_status_change(complaint, old_status, new_status)


# PUBLIC: ADMIN - CLOSE

@transaction.atomic
def admin_close(complaint, admin_user):
    """
    Close a resolved or rejected complaint.
    """
    _transition_status(
        complaint, ComplaintStatus.CLOSED,
        actor=admin_user, actor_role='admin',
        event_type=ComplaintEventType.COMPLAINT_CLOSED,
    )


# PUBLIC: ADMIN - RE-TRIAGE (from NEEDS_MORE_INFO back to TRIAGED)

@transaction.atomic
def admin_retriage(complaint, admin_user, note=''):
    """
    Admin re-triages a complaint after receiving more info.
    """
    _transition_status(
         complaint, ComplaintStatus.TRIAGED,
        actor=admin_user, actor_role='admin',
        event_type=ComplaintEventType.COMPLAINT_TRIAGED,
        payload={'note': note, 'action': 'retriage'} if note else {'action': 'retriage'},
    )
    
