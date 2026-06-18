from django.contrib.auth import authenticate
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_decode
from django.db import transaction
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from accounts.models import Account
from accounts.tasks import send_activation_email_task, send_password_reset_task
from utils.exceptions import AuthenticationError, ValidationError
import logging

logger = logging.getLogger('accounts.auth')


# =============================================================================
# COOKIE HELPERS
# =============================================================================

def set_refresh_cookie(response, token):
    """Set refresh token as HttpOnly cookie."""
    response.set_cookie(
        key="refresh_token",
        value=str(token),
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/",
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
    )


def clear_refresh_cookie(response):
    """Clear refresh token cookie."""
    response.delete_cookie(
        key="refresh_token",
        path="/",
        domain=settings.COOKIE_DOMAIN,
        samesite=settings.COOKIE_SAMESITE,
    )


# =============================================================================
# AUTH SERVICES
# =============================================================================

@transaction.atomic
def register_user(serializer) -> Account:
    """
    Persist a new user account and dispatch the activation email.

    Args:
        serializer: A validated AccountRegisterSerializer instance.
        Validation must be done in the view before calling this.

    Returns:
        Newly created (inactive) Account
    """
    user = serializer.save()

    transaction.on_commit(
        lambda user_id=user.id: send_activation_email_task.delay(user_id)
    )

    logger.info(f"User registered: {user.email}")
    return user


def activate_user(uidb64: str, token: str) -> Account:
    """
    Activate a user account using the activation token.

    Args:
        uidb64: Base64-encoded user ID
        token: Activation token

    Returns:
        Activated Account

    Raises:
        ValidationError: If token is invalid or expired
    """
    try:
        uid = urlsafe_base64_decode(uidb64).decode()
        user = Account.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, Account.DoesNotExist):
        raise ValidationError(
            detail="Invalid activation link.",
            code="invalid_activation_link"
        )

    if not default_token_generator.check_token(user, token):
        raise ValidationError(
            detail="Activation link is invalid or expired.",
            code="expired_activation_link"
        )

    if user.is_active:
        raise ValidationError(
            detail="Account is already activated.",
            code="already_activated"
        )

    user.is_active = True
    user.save(update_fields=['is_active'])

    logger.info(f"User activated: {user.email}")
    return user


def login_user(email: str, password: str, request=None) -> dict:
    """
    Authenticate user and generate tokens.

    Args:
        email: User email
        password: User password
        request: Optional request object for logging

    Returns:
        Dict with 'user', 'access', 'refresh' keys

    Raises:
        AuthenticationError: If credentials are invalid
    """
    email = email.lower().strip()

    user = authenticate(request=request, email=email, password=password)

    if user is None:
        logger.warning(f"Failed login attempt for: {email}")
        raise AuthenticationError(
            detail="Invalid email or password.",
            code="invalid_credentials"
        )

    if not user.is_active:
        raise AuthenticationError(
            detail="Account is not activated. Please verify your email.",
            code="account_inactive"
        )

    refresh = RefreshToken.for_user(user)

    logger.info(f"User logged in: {user.email}")

    return {
        'user': user,
        'access': str(refresh.access_token),
        'refresh': refresh,
    }


def refresh_tokens(refresh_token: str) -> dict:
    """
    Generate new access token from refresh token.

    Args:
        refresh_token: Current refresh token string

    Returns:
        Dict with 'access' and 'refresh' keys

    Raises:
        AuthenticationError: If token is invalid
    """
    if not refresh_token:
        raise AuthenticationError(
            detail="Refresh token not provided.",
            code="missing_token"
        )

    try:
        refresh = RefreshToken(refresh_token)

        # Verify user still exists and is active
        user_id = refresh["user_id"]
        user = Account.objects.get(id=user_id)

        if not user.is_active:
            raise AuthenticationError(
                detail="Account is inactive.",
                code="account_inactive"
            )

        return {
            'access': str(refresh.access_token),
            'refresh': refresh,
        }

    except TokenError:
        raise AuthenticationError(
            detail="Invalid or expired refresh token.",
            code="invalid_token"
        )
    except Account.DoesNotExist:
        raise AuthenticationError(
            detail="User not found.",
            code="user_not_found"
        )


def logout_user(refresh_token: str) -> None:
    """
    Logout user (currently just clears cookie, no blacklist).

    Args:
        refresh_token: Refresh token to invalidate
    """
    # Token blacklist not enabled, cookie will be cleared by view
    if refresh_token:
        logger.info("User logged out")


def request_password_reset(email: str) -> None:
    """
    Request password reset for an email.
    Always succeeds to prevent email enumeration.

    Args:
        email: Email to send reset link to
    """
    email = email.lower().strip()

    try:
        user = Account.objects.get(email=email)
        if user.is_active:
            transaction.on_commit(
                lambda user_id=user.id: send_password_reset_task.delay(user_id)
            )
            logger.info(f"Password reset requested for: {email}")
    except Account.DoesNotExist:
        # Don't reveal that email doesn't exist
        pass


def reset_password(uidb64: str, token: str, new_password: str) -> Account:
    """
    Reset user password using reset token.

    Args:
        uidb64: Base64-encoded user ID
        token: Password reset token
        new_password: New password

    Returns:
        Updated Account

    Raises:
        ValidationError: If token is invalid
    """
    try:
        uid = urlsafe_base64_decode(uidb64).decode()
        user = Account.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, Account.DoesNotExist):
        raise ValidationError(
            detail="Invalid password reset link.",
            code="invalid_reset_link"
        )

    if not default_token_generator.check_token(user, token):
        raise ValidationError(
            detail="Password reset link is invalid or expired.",
            code="expired_reset_link"
        )

    user.set_password(new_password)
    user.save(update_fields=['password'])

    logger.info(f"Password reset completed for: {user.email}")
    return user


def change_password(user: Account, new_password: str) -> None:
    """
    Change password for an authenticated user.

    Args:
        user: The Account instance (already authenticated, current password
              already verified by PasswordChangeSerializer).
        new_password: The new plaintext password (already validated).
    """
    user.set_password(new_password)
    user.save(update_fields=['password'])
    logger.info(f"Password changed for: {user.email}")
