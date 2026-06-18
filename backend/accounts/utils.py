from django.conf import settings 
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.utils.html import strip_tags
from django.template.loader import render_to_string


def send_activation_mail(user):
    """
    Send account activation link in the mail
    """

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    activation_link = (
        f"{settings.FRONTEND_URL}/activate"
        f"?uid={uid}&token={token}"
    )

    subject = "Activate your ConnectNepal account"

    # render HTML template with context
    html_message = render_to_string('emails/account_activation.html', {
        'user': user,
        'user_email': user.email,
        'activation_link': activation_link,
    })

    # plain text version
    plain_message = strip_tags(html_message)

    email = EmailMultiAlternatives(
        subject=subject,
        body=plain_message,
        from_email=settings.EMAIL_HOST_USER,
        to=[user.email],
    )
    
    email.attach_alternative(html_message, 'text/html')

    email.send(fail_silently=False)


def send_password_changed_mail(user) -> None:
    """
    Send a security confirmation email after a successful password change.
    """
    from django.utils import timezone
    changed_at = timezone.now()

    html_message = render_to_string('emails/password_changed.html', {
        'user': user,
        'user_email': user.email,
        'changed_at': changed_at,
        'frontend_url': settings.FRONTEND_URL,
    })
    plain_message = strip_tags(html_message)

    email = EmailMultiAlternatives(
        subject="Your ConnectNepal password was changed",
        body=plain_message,
        from_email=settings.EMAIL_HOST_USER,
        to=[user.email],
    )
    email.attach_alternative(html_message, 'text/html')
    email.send(fail_silently=False)


def send_password_reset_mail(user):
    """
    Send password reset link via HTML email
    """
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    reset_link = (
        f"{settings.FRONTEND_URL}/reset-password"
        f"?uid={uid}&token={token}"
    )

    subject = "Reset Your Connect Nepal Password"

    # Render HTML template with context
    html_message = render_to_string('emails/password_reset.html', {
        'user': user,
        'user_email': user.email,
        'reset_link': reset_link,
    })

    # Generate plain text version
    plain_message = strip_tags(html_message)

    email = EmailMultiAlternatives(
        subject=subject,
        body=plain_message,
        from_email=settings.EMAIL_HOST_USER,
        to=[user.email],
    )

    email.attach_alternative(html_message, 'text/html')

    email.send(fail_silently=False)
