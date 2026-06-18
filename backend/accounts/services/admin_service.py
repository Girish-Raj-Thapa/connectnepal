import logging 
from django.db import transaction
from django.utils import timezone

from accounts.models import HostDetail, Account, AccountStatusLog
from notifications.constants import NotificationPriority, NotificationType
from notifications.services.notification_realtime_service import send_ws_notification
from notifications.services.notification_service import create_notification
from utils.exceptions import ServiceError, ValidationError

logger = logging.getLogger('accounts')


def _queue_ws_notification(notification):
    if notification:
        transaction.on_commit(lambda n=notification: send_ws_notification(n))


def list_hosts(verification_status: str = None):
    """
    Return a queryset of HostDetail rows, optionally filtered by verification_status.

    Args:
        verification_status: One of 'not_submitted', 'pending', 'approved', 'rejected'.
        Pass None to return all hosts.

    Returns:
        QuerySet[HostDetail] with select_related and prefetch_related set for
        efficient serialization.

    Raises:
        ValidationError: If the given status string is not a valid choice.
    """
    if verification_status is not None:
        valid_values = {s.value for s in HostDetail.VerificationStatus}

        if verification_status not in valid_values:
            raise ValidationError(
                detail=f"Invalid status '{verification_status}'. "
                       f"Must be one of: {', '.join(sorted(valid_values))}.",
                code="invalid_verification_status",
            )

    qs = (
        HostDetail.objects
        .select_related('user', 'verified_by')
        .prefetch_related('documents')
        .order_by('-user__created_at')
    )  

    if verification_status is not None:
        qs = qs.filter(verification_status=verification_status)
    
    return qs 


@transaction.atomic
def approve_host(host_detail_id: int, admin_user: Account) -> HostDetail:
    """
    Approve a host's verification.

    Sets status to APPROVED, records which admin approved and when, and
    clears any prior rejection remarks.

    Uses select_for_update() so two concurrent approve requests on the same host don't both succeed — the second one will see APPROVED and get a 400.

    Args:
        host_detail_id: PK of the HostDetail (same integer as the host's Account PK).
        admin_user: The logged-in admin Account performing the action.

    Returns:
        The updated HostDetail instance.

    Raises:
        ServiceError(404, host_not_found):   No HostDetail with that PK.
        ServiceError(400, already_approved): Host is already APPROVED.
    """
    try: 
        host = HostDetail.objects.select_for_update().get(pk=host_detail_id)
    except HostDetail.DoesNotExist:
        raise ServiceError(
            detail="Host not found.",
            code="host_not_found",
            status_code=404,
        )
    
    if host.verification_status == HostDetail.VerificationStatus.APPROVED:
        raise ServiceError(
            detail="This host is already approved.",
            code="already_approved",
            status_code=400,
        )
    
    host.verification_status = HostDetail.VerificationStatus.APPROVED
    host.verified_by = admin_user
    host.verified_at = timezone.now()
    host.verification_remarks = None # clear any stale rejection text

    host.save(update_fields=[
        'verification_status',
        'verified_by',
        'verified_at',
        'verification_remarks',
    ])

    notification = create_notification(
        recipient=host.user,
        notification_type=NotificationType.HOST_VERIFIED,
        title="Verification Approved",
        body=(
            "Your host account has been verified! You can now publish listings "
            "and accept bookings without limits. If any of your listings were "
            "suspended due to the transaction limit, go to your dashboard to "
            "re-publish them."
        ),
        action_url="/host/listings",
        metadata={
            "host_id": host.pk,
            "verification_status": host.verification_status,
        },
        dedupe_key=f"host_verification:{host.pk}:{host.verification_status}",
        priority=NotificationPriority.HIGH,
    )
    _queue_ws_notification(notification)

    logger.info(
        f"Host approved: host_id={host_detail_id}, admin={admin_user.email}"
    )
    return host


@transaction.atomic
def reject_host(host_detail_id: int, admin_user: Account, remarks: str) -> HostDetail:
    """
    Reject a host's verification.

    Sets status to REJECTED, records which admin rejected and when,
    and saves the mandatory rejection remarks so the host knows why.

    Args:
        host_detail_id: PK of the HostDetail.
        admin_user: The logged-in admin Account.
        remarks: Non-empty explanation of why the host was rejected. The serializer enforces min_length=10; this function adds a defensive blank-check as a second gate.

    Returns:
        The updated HostDetail instance.

    Raises:
        ValidationError(remarks_required):    remarks is blank.
        ServiceError(404, host_not_found):    No HostDetail with that PK.
        ServiceError(400, already_rejected):  Host is already REJECTED.
    """
    if not remarks or not remarks.strip():
        raise ValidationError(
            detail="Rejection remarks are required.",
            code="remarks_required",
        )
    
    try: 
        host = HostDetail.objects.select_for_update().get(pk=host_detail_id)
    except HostDetail.DoesNotExist:
        raise ServiceError(
            detail="Host not found.",
            code="host_not_found",
            status_code=404,
        )
    
    if host.verification_status == HostDetail.VerificationStatus.REJECTED:
        raise ServiceError(
            detail="This host is already rejected.",
            code="already_rejected",
            status_code=400,
        )
    
    host.verification_status = HostDetail.VerificationStatus.REJECTED
    host.verified_by = admin_user
    host.verified_at = timezone.now()
    host.verification_remarks = remarks.strip()

    host.save(update_fields=[
        'verification_status',
        'verified_by',
        'verified_at',
        'verification_remarks',
    ])

    notification = create_notification(
        recipient=host.user,
        notification_type=NotificationType.HOST_VERIFICATION_REJECTED,
        title="Verification Update",
        body=f"Your verification was not approved. Reason: {host.verification_remarks}",
        action_url="/host/profile",
        metadata={
            "host_id": host.pk,
            "verification_status": host.verification_status,
        },
        dedupe_key=f"host_verification:{host.pk}:{host.verification_status}",
        priority=NotificationPriority.HIGH,
    )
    _queue_ws_notification(notification)

    logger.info(
        f"Host rejected: host_id={host_detail_id}, "
        f"admin={admin_user.email}, remarks='{remarks[:80]}'"
    )
    return host


# ---------------------------------------------------------------------------
# Admin — User Management
# ---------------------------------------------------------------------------

def list_users():
    """
    Return a queryset of all Account rows ordered by newest first.

    Filtering is handled by AdminUserFilter at the view layer.
    """
    return Account.objects.all().order_by('-created_at')


def get_user_detail(user_id: int) -> Account:
    """
    Fetch a single Account by PK.

    Raises:
        ServiceError(404, user_not_found): No Account with that PK.
    """
    try:
        return Account.objects.get(pk=user_id)
    except Account.DoesNotExist:
        raise ServiceError(
            detail="User not found.",
            code="user_not_found",
            status_code=404,
        )


@transaction.atomic
def block_user(user_id: int, admin_user: Account, reason: str = "") -> Account:
    """
    Block a user by setting is_active=False.

    Guards:
        - Cannot block yourself
        - Cannot block other admin accounts
        - Cannot block an already-blocked user

    Creates an AccountStatusLog entry for audit.
    """
    try:
        target = Account.objects.select_for_update().get(pk=user_id)
    except Account.DoesNotExist:
        raise ServiceError(
            detail="User not found.",
            code="user_not_found",
            status_code=404,
        )

    if target.pk == admin_user.pk:
        raise ServiceError(
            detail="You cannot block your own account.",
            code="self_block",
            status_code=400,
        )

    if target.role == Account.Role.ADMIN:
        raise ServiceError(
            detail="Admin accounts cannot be blocked via this endpoint.",
            code="cannot_block_admin",
            status_code=400,
        )

    if not target.is_active:
        raise ServiceError(
            detail="User is already blocked.",
            code="already_blocked",
            status_code=400,
        )

    target.is_active = False
    target.save(update_fields=['is_active'])

    AccountStatusLog.objects.create(
        account=target,
        action=AccountStatusLog.ActionType.BLOCK,
        reason=reason.strip(),
        performed_by=admin_user,
    )

    logger.info(f"User blocked: user_id={user_id}, admin={admin_user.email}")
    return target


@transaction.atomic
def unblock_user(user_id: int, admin_user: Account) -> Account:
    """
    Unblock a user by setting is_active=True.

    Guards:
        - Cannot unblock an already-active user

    Creates an AccountStatusLog entry for audit.
    """
    try:
        target = Account.objects.select_for_update().get(pk=user_id)
    except Account.DoesNotExist:
        raise ServiceError(
            detail="User not found.",
            code="user_not_found",
            status_code=404,
        )

    if target.is_active:
        raise ServiceError(
            detail="User is already active.",
            code="already_active",
            status_code=400,
        )

    target.is_active = True
    target.save(update_fields=['is_active'])

    AccountStatusLog.objects.create(
        account=target,
        action=AccountStatusLog.ActionType.UNBLOCK,
        reason="",
        performed_by=admin_user,
    )

    logger.info(f"User unblocked: user_id={user_id}, admin={admin_user.email}")
    return target
