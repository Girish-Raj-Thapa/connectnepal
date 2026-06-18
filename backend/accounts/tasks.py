from celery import shared_task
from .models import Account
from .utils import send_activation_mail, send_password_reset_mail, send_password_changed_mail

@shared_task(bind=True, max_retries=3)
def send_activation_email_task(self, user_id):
    """
    Background task to send account activation email
    
    Args:
        user_id: The user's primary key
    
    Retries up to 3 times with exponential backoff on failure
    """

    try:
        user = Account.objects.get(pk=user_id)

        send_activation_mail(user)

        return f'Acivation email sent successfully to {user.email}'
    
    except Account.DoesNotExist:
        return f'User with ID: {user_id} not found'
    
    except Exception as exc:
        # Retry with exponential backoff on any other error
        # Retry 1: wait 5s, Retry 2: wait 10s, Retry 3: wait 20s
        raise self.retry(exc=exc, countdown=5 * (2 ** self.request.retries))
    

@shared_task(bind=True, max_retries=3)
def send_password_reset_task(self, user_id):
    """
    Background task to send password reset email

    Args:
        user_id: The user's primary key
    
    Retries up to 3 times with exponential backoff on failure
    """
    try:
        user = Account.objects.get(pk=user_id)
        send_password_reset_mail(user)
        return f"Password reset email sent successfully to {user.email}"
    
    except Account.DoesNotExist:
        return f'User with ID: {user_id} not found'
    
    except Exception as exc:
        # Retry with exponential backoff on any other error
        raise self.retry(exc=exc, countdown=5 * (2 ** self.request.retries))


@shared_task(bind=True, max_retries=3)
def send_password_changed_task(self, user_id):
    """
    Send a security confirmation email after a user changes their password.

    Args:
        user_id: The user's primary key.
    """
    try:
        user = Account.objects.get(pk=user_id)
        send_password_changed_mail(user)
        return f"Password changed email sent to {user.email}"

    except Account.DoesNotExist:
        return f"User {user_id} not found"

    except Exception as exc:
        raise self.retry(exc=exc, countdown=5 * (2 ** self.request.retries))