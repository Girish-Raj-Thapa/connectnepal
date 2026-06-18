from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.utils import timezone
from django.db import models
from .managers import AccountManager


class Account(AbstractBaseUser, PermissionsMixin):
    """
    Custom User Model for ConnectNepal
    Supports three roles: Traveller, Host, and Admin
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        TRAVELLER = "traveller", "Traveller"
        HOST = "host", "Host"

    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"
        PREFER_NOT_TO_SAY = "prefer_not_to_say", "Prefer not to say"


    # Basic Information
    first_name = models.CharField(max_length=200, blank=True)
    middle_name = models.CharField(max_length=200, blank=True)
    last_name = models.CharField(max_length=200, blank=True)

    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True, null=True)

    date_of_birth = models.DateField(blank=True, null=True)
    gender = models.CharField(max_length=20, choices=Gender.choices, blank=True, null=True)

    profile_photo = models.ImageField(upload_to='photos/users/', blank=True, null=True)
    address = models.TextField(blank=True, null=True)

    # Location
    country = models.CharField(max_length=100, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)

    # Role
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.TRAVELLER)

    # Onboarding tracking
    has_completed_onboarding = models.BooleanField(default=False)
    onboarding_step = models.IntegerField(default=0)

    # Financial tracking (for host limits)
    total_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    # Account status
    is_active = models.BooleanField(default=False)
    is_admin = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_superadmin = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['role']

    objects = AccountManager()


    def __str__(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.email

    @property
    def full_name(self):
        """Returns the full name of the user"""
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join(part for part in parts if part).strip() or self.email

    @property
    def age(self):
        """Calculate age from date of birth"""
        if self.date_of_birth:
            today = timezone.now().date()
            return today.year - self.date_of_birth.year - (
                (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
            )
        return None


class TravellerDetail(models.Model):
    """
    Extended profile information for Traveller users
    Stores travel preferences for personalized recommendations
    """

    user = models.OneToOneField(Account, on_delete=models.CASCADE, primary_key=True,related_name='traveller_detail')

    # Emergency contact
    emergency_contact = models.CharField(max_length=30, blank=True, null=True)

    # Travel preferences
    preferred_activities = models.JSONField(default=list, blank=True, help_text="List of preferred activity tags (e.g., ['Hiking', 'Cultural Tours'])")

    preferred_min_budget = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)

    preferred_max_budget = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)

    preferred_trip_style = models.CharField(max_length=50, blank=True, null=True, help_text="e.g., Solo, Couple, Family, Group, Luxury, Budget Traveler")

    def __str__(self):
        return f"Traveller Profile: {self.user.email}"


class HostDetail(models.Model):
    """
    Extended profile information for Host users
    Stores business information and verification status
    """

    class VerificationStatus(models.TextChoices):
        NOT_SUBMITTED = "not_submitted", "Not Submitted"
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.OneToOneField(Account, on_delete=models.CASCADE, primary_key=True, related_name='host_detail')

    # Business Information
    business_name = models.CharField(max_length=255, blank=True, null=True)
    business_address = models.TextField(blank=True, null=True)
    business_phone = models.CharField(max_length=30, blank=True, null=True)
    about_service = models.TextField(blank=True, null=True, help_text="Description of services offered")

    # Verification
    verification_status = models.CharField(max_length=20, choices=VerificationStatus.choices, default=VerificationStatus.NOT_SUBMITTED)
    verification_remarks = models.TextField(blank=True, null=True)
    verified_by = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_hosts')
    verified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Host Profile: {self.business_name or self.user.email}"

    @property
    def is_verified(self):
        """Check if host is verified"""
        return self.verification_status == self.VerificationStatus.APPROVED


class AdminDetail(models.Model):
    """
    Extended profile information for Admin users
    """

    user = models.OneToOneField(Account, on_delete=models.CASCADE, primary_key=True, related_name='admin_detail')

    admin_level = models.CharField(max_length=50, blank=True, null=True)
    date_of_joining = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"Admin Profile: {self.user.email}"


class HostDocument(models.Model):
    """
    Stores verification documents uploaded by hosts
    """

    class DocumentType(models.TextChoices):
        CITIZENSHIP = "citizenship", "Citizenship"
        PAN = "pan", "PAN Registration"
        BUSINESS_LICENSE = "business_license", "Business License"

    host = models.ForeignKey(HostDetail, on_delete=models.CASCADE,related_name='documents')

    document_type = models.CharField(max_length=20, choices=DocumentType.choices)

    file_path = models.FileField(upload_to='documents/hosts/')

    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['host', 'document_type']

    def __str__(self):
        return f"{self.host.business_name} - {self.get_document_type_display()}"


class AccountStatusLog(models.Model):
    """
    Audit trail for admin block/unblock actions on user accounts.
    """

    class ActionType(models.TextChoices):
        BLOCK = "block", "Block"
        UNBLOCK = "unblock", "Unblock"

    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="status_logs",
    )
    action = models.CharField(max_length=10, choices=ActionType.choices)
    reason = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_status_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} on {self.account.email} by {self.performed_by.email if self.performed_by else 'system'}"
