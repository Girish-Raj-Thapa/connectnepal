from django.db import models
from django.conf import settings

# ENUMS

class ComplaintCategory(models.TextChoices):
    MISLEADING_LISTING = "misleading_listing", "Misleading Listing"
    MISLEADING_PACKAGE = "misleading_package", "Misleading Package"
    ITINERARY_MISMATCH = "itinerary_mismatch", "Itinerary Mismatch"
    AMENITY_NOT_AS_DESCRIBED = "amenity_not_as_described", "Amenity Not As Described"
    NO_SHOW = "no_show", "No Show"
    DELAY_OR_NON_DELIVERY = "delay_or_non_delivery", "Delay or Non-Delivery"
    POOR_COMMUNICATION = "poor_communication", "Poor Communication"
    HOST_MISCONDUCT = "host_misconduct", "Host Misconduct"
    TRAVELLER_MISCONDUCT = "traveller_misconduct", "Traveller Misconduct"
    HARASSMENT = "harassment", "Harassment"
    DISCRIMINATION = "discrimination", "Discrimination"
    EXTRA_CHARGE_DEMANDED = "extra_charge_demanded", "Extra Charge Demanded"
    OFF_PLATFORM_PAYMENT_PRESSURE = "off_platform_payment_pressure", "Off-Platform Payment Pressure"
    REFUND_DISPUTE = "refund_dispute", "Refund Dispute"
    FRAUD_OR_SCAM = "fraud_or_scam", "Fraud or Scam"
    SAFETY_CONCERN = "safety_concern", "Safety Concern"
    PROPERTY_DAMAGE = "property_damage", "Property Damage"
    THREATENING_BEHAVIOR = "threatening_behavior", "Threatening Behavior"
    OTHER = "other", "Other"


class ComplaintSeverity(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    CRITICAL = "critical", "Critical"


class ComplaintStatus(models.TextChoices):
    SUBMITTED = "submitted", "Submitted"
    TRIAGED = "triaged", "Triaged"
    NEEDS_MORE_INFO = "needs_more_info", "Needs More Info"
    AWAITING_RESPONDENT = "awaiting_respondent", "Awaiting Respondent"
    UNDER_REVIEW = "under_review", "Under Review"
    ESCALATED = "escalated", "Escalated"
    RESOLVED = "resolved", "Resolved"
    REJECTED = "rejected", "Rejected"
    CLOSED = "closed", "Closed"


class ComplaintOutcome(models.TextChoices):
    NO_VIOLATION = "no_violation", "No Violation"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence", "Insufficient Evidence"
    MINOR_VIOLATION = "minor_violation", "Minor Violation"
    MAJOR_VIOLATION = "major_violation", "Major Violation"
    PARTIALLY_SUBSTANTIATED = "partially_substantiated", "Partially Substantiated"
    MALICIOUS_REPORT = "malicious_report", "Malicious Report"


class ComplaintEventType(models.TextChoices):
    COMPLAINT_SUBMITTED = "complaint_submitted", "Complaint Submitted"
    EVIDENCE_ADDED = "evidence_added", "Evidence Added"
    COMPLAINT_TRIAGED = "complaint_triaged", "Complaint Triaged"
    SEVERITY_UPDATED = "severity_updated", "Severity Updated"
    MORE_INFO_REQUESTED = "more_info_requested", "More Info Requested"
    RESPONDENT_NOTIFIED = "respondent_notified", "Respondent Notified"
    RESPONSE_RECEIVED = "response_received", "Response Received"
    REVIEW_STARTED = "review_started", "Review Started"
    COMPLAINT_ESCALATED = "complaint_escalated", "Complaint Escalated"
    OUTCOME_RECORDED = "outcome_recorded", "Outcome Recorded"
    COMPLAINT_CLOSED = "complaint_closed", "Complaint Closed"
    PROTECTIVE_ACTION_RECORDED = "protective_action_recorded", "Protective Action Recorded"


class FiledByRole(models.TextChoices):
    TRAVELLER = "traveller", "Traveller"
    HOST = "host", "Host"


from django.conf import settings
from django.db import models


# ─────────────────────────────────────────────────────────
# ENUMS
# ─────────────────────────────────────────────────────────

class ComplaintCategory(models.TextChoices):
    MISLEADING_LISTING = "misleading_listing", "Misleading Listing"
    MISLEADING_PACKAGE = "misleading_package", "Misleading Package"
    ITINERARY_MISMATCH = "itinerary_mismatch", "Itinerary Mismatch"
    AMENITY_NOT_AS_DESCRIBED = "amenity_not_as_described", "Amenity Not As Described"
    NO_SHOW = "no_show", "No Show"
    DELAY_OR_NON_DELIVERY = "delay_or_non_delivery", "Delay or Non-Delivery"
    POOR_COMMUNICATION = "poor_communication", "Poor Communication"
    HOST_MISCONDUCT = "host_misconduct", "Host Misconduct"
    TRAVELLER_MISCONDUCT = "traveller_misconduct", "Traveller Misconduct"
    HARASSMENT = "harassment", "Harassment"
    DISCRIMINATION = "discrimination", "Discrimination"
    EXTRA_CHARGE_DEMANDED = "extra_charge_demanded", "Extra Charge Demanded"
    OFF_PLATFORM_PAYMENT_PRESSURE = "off_platform_payment_pressure", "Off-Platform Payment Pressure"
    REFUND_DISPUTE = "refund_dispute", "Refund Dispute"
    FRAUD_OR_SCAM = "fraud_or_scam", "Fraud or Scam"
    SAFETY_CONCERN = "safety_concern", "Safety Concern"
    PROPERTY_DAMAGE = "property_damage", "Property Damage"
    THREATENING_BEHAVIOR = "threatening_behavior", "Threatening Behavior"
    OTHER = "other", "Other"


class ComplaintSeverity(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    CRITICAL = "critical", "Critical"


class ComplaintStatus(models.TextChoices):
    SUBMITTED = "submitted", "Submitted"
    TRIAGED = "triaged", "Triaged"
    NEEDS_MORE_INFO = "needs_more_info", "Needs More Info"
    AWAITING_RESPONDENT = "awaiting_respondent", "Awaiting Respondent"
    UNDER_REVIEW = "under_review", "Under Review"
    ESCALATED = "escalated", "Escalated"
    RESOLVED = "resolved", "Resolved"
    REJECTED = "rejected", "Rejected"
    CLOSED = "closed", "Closed"


class ComplaintOutcome(models.TextChoices):
    NO_VIOLATION = "no_violation", "No Violation"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence", "Insufficient Evidence"
    MINOR_VIOLATION = "minor_violation", "Minor Violation"
    MAJOR_VIOLATION = "major_violation", "Major Violation"
    PARTIALLY_SUBSTANTIATED = "partially_substantiated", "Partially Substantiated"
    MALICIOUS_REPORT = "malicious_report", "Malicious Report"


class ComplaintEventType(models.TextChoices):
    COMPLAINT_SUBMITTED = "complaint_submitted", "Complaint Submitted"
    EVIDENCE_ADDED = "evidence_added", "Evidence Added"
    COMPLAINT_TRIAGED = "complaint_triaged", "Complaint Triaged"
    SEVERITY_UPDATED = "severity_updated", "Severity Updated"
    MORE_INFO_REQUESTED = "more_info_requested", "More Info Requested"
    RESPONDENT_NOTIFIED = "respondent_notified", "Respondent Notified"
    RESPONSE_RECEIVED = "response_received", "Response Received"
    REVIEW_STARTED = "review_started", "Review Started"
    COMPLAINT_ESCALATED = "complaint_escalated", "Complaint Escalated"
    OUTCOME_RECORDED = "outcome_recorded", "Outcome Recorded"
    COMPLAINT_CLOSED = "complaint_closed", "Complaint Closed"
    PROTECTIVE_ACTION_RECORDED = "protective_action_recorded", "Protective Action Recorded"


class FiledByRole(models.TextChoices):
    TRAVELLER = "traveller", "Traveller"
    HOST = "host", "Host"


# REPORTING WINDOW CONFIG  (days after BookingItem.completed_at)

#  72 hours ≈ 3 days — service/listing/package mismatch, no-show, incident during trip
#  7 days — financial disputes, property damage
# 30 days — conduct issues, other
# 90 days — safety/critical (extended window for sensitive matters)

REPORTING_WINDOW_DAYS = {
    ComplaintCategory.MISLEADING_LISTING: 3,
    ComplaintCategory.MISLEADING_PACKAGE: 3,
    ComplaintCategory.ITINERARY_MISMATCH: 3,
    ComplaintCategory.AMENITY_NOT_AS_DESCRIBED: 3,
    ComplaintCategory.NO_SHOW: 3,
    ComplaintCategory.DELAY_OR_NON_DELIVERY: 3,
    ComplaintCategory.POOR_COMMUNICATION: 7,
    ComplaintCategory.EXTRA_CHARGE_DEMANDED: 7,
    ComplaintCategory.OFF_PLATFORM_PAYMENT_PRESSURE: 7,
    ComplaintCategory.REFUND_DISPUTE: 7,
    ComplaintCategory.PROPERTY_DAMAGE: 7,
    ComplaintCategory.HOST_MISCONDUCT: 30,
    ComplaintCategory.TRAVELLER_MISCONDUCT: 30,
    ComplaintCategory.OTHER: 30,
    ComplaintCategory.HARASSMENT: 90,
    ComplaintCategory.DISCRIMINATION: 90,
    ComplaintCategory.FRAUD_OR_SCAM: 90,
    ComplaintCategory.SAFETY_CONCERN: 90,
    ComplaintCategory.THREATENING_BEHAVIOR: 90,
}


# CATEGORY → INITIAL SEVERITY MAPPING

INITIAL_SEVERITY = {
    ComplaintCategory.POOR_COMMUNICATION: ComplaintSeverity.LOW,
    ComplaintCategory.OTHER: ComplaintSeverity.LOW,

    ComplaintCategory.MISLEADING_LISTING: ComplaintSeverity.MEDIUM,
    ComplaintCategory.MISLEADING_PACKAGE: ComplaintSeverity.MEDIUM,
    ComplaintCategory.ITINERARY_MISMATCH: ComplaintSeverity.MEDIUM,
    ComplaintCategory.AMENITY_NOT_AS_DESCRIBED: ComplaintSeverity.MEDIUM,
    ComplaintCategory.NO_SHOW: ComplaintSeverity.MEDIUM,
    ComplaintCategory.DELAY_OR_NON_DELIVERY: ComplaintSeverity.MEDIUM,
    ComplaintCategory.REFUND_DISPUTE: ComplaintSeverity.MEDIUM,

    ComplaintCategory.HOST_MISCONDUCT: ComplaintSeverity.HIGH,
    ComplaintCategory.TRAVELLER_MISCONDUCT: ComplaintSeverity.HIGH,
    ComplaintCategory.EXTRA_CHARGE_DEMANDED: ComplaintSeverity.HIGH,
    ComplaintCategory.OFF_PLATFORM_PAYMENT_PRESSURE: ComplaintSeverity.HIGH,
    ComplaintCategory.PROPERTY_DAMAGE: ComplaintSeverity.HIGH,

    ComplaintCategory.HARASSMENT: ComplaintSeverity.CRITICAL,
    ComplaintCategory.DISCRIMINATION: ComplaintSeverity.CRITICAL,
    ComplaintCategory.FRAUD_OR_SCAM: ComplaintSeverity.CRITICAL,
    ComplaintCategory.SAFETY_CONCERN: ComplaintSeverity.CRITICAL,
    ComplaintCategory.THREATENING_BEHAVIOR: ComplaintSeverity.CRITICAL,
}


# CATEGORIES THAT REQUIRE EVIDENCE

CATEGORIES_REQUIRING_EVIDENCE = {
    ComplaintCategory.AMENITY_NOT_AS_DESCRIBED,
    ComplaintCategory.PROPERTY_DAMAGE,
    ComplaintCategory.EXTRA_CHARGE_DEMANDED,
    ComplaintCategory.FRAUD_OR_SCAM,
}


# SENSITIVE CATEGORIES (limited disclosure to respondent)

SENSITIVE_CATEGORIES = {
    ComplaintCategory.HARASSMENT,
    ComplaintCategory.DISCRIMINATION,
    ComplaintCategory.THREATENING_BEHAVIOR,
    ComplaintCategory.SAFETY_CONCERN,
}


# STATUS TRANSITION TABLE
# Maps (from_status) → set of allowed (to_status) values.
# Enforced in the service layer. Admin is the only actor who can
# trigger direct transitions (except AWAITING_RESPONDENT → UNDER_REVIEW
# which can happen automatically when a response is received).

ALLOWED_TRANSITIONS = {
    ComplaintStatus.SUBMITTED: {
        ComplaintStatus.TRIAGED,
        ComplaintStatus.NEEDS_MORE_INFO,  # admin can request info before triaging
        ComplaintStatus.REJECTED,          # fast-reject: spam or clearly invalid
    },
    ComplaintStatus.TRIAGED: {
        ComplaintStatus.NEEDS_MORE_INFO,
        ComplaintStatus.AWAITING_RESPONDENT,
        ComplaintStatus.UNDER_REVIEW,
        ComplaintStatus.ESCALATED,
        ComplaintStatus.RESOLVED,       # fast-track outcome after triage
        ComplaintStatus.REJECTED,       # fast-reject after triage
    },
    ComplaintStatus.NEEDS_MORE_INFO: {
        ComplaintStatus.TRIAGED,        # admin re-triages after info received
        ComplaintStatus.REJECTED,
    },
    ComplaintStatus.AWAITING_RESPONDENT: {
        ComplaintStatus.UNDER_REVIEW,   # auto or manual after response
    },
    ComplaintStatus.UNDER_REVIEW: {
        ComplaintStatus.ESCALATED,
        ComplaintStatus.RESOLVED,
        ComplaintStatus.REJECTED,
    },
    ComplaintStatus.ESCALATED: {
        ComplaintStatus.RESOLVED,
        ComplaintStatus.REJECTED,
    },
    ComplaintStatus.RESOLVED: {
        ComplaintStatus.CLOSED,
    },
    ComplaintStatus.REJECTED: {
        ComplaintStatus.CLOSED,
    },
    ComplaintStatus.CLOSED: set(),      # terminal
}


# Statuses that indicate a complaint is still active (not yet closed or rejected)
ACTIVE_COMPLAINT_STATUSES = (
    ComplaintStatus.SUBMITTED,
    ComplaintStatus.TRIAGED,
    ComplaintStatus.NEEDS_MORE_INFO,
    ComplaintStatus.AWAITING_RESPONDENT,
    ComplaintStatus.UNDER_REVIEW,
    ComplaintStatus.ESCALATED,
)


# Outcomes that result in RESOLVED status
RESOLVED_OUTCOMES = {
    ComplaintOutcome.MINOR_VIOLATION,
    ComplaintOutcome.MAJOR_VIOLATION,
    ComplaintOutcome.PARTIALLY_SUBSTANTIATED,
    ComplaintOutcome.MALICIOUS_REPORT,
}

# Outcomes that result in REJECTED status
REJECTED_OUTCOMES = {
    ComplaintOutcome.NO_VIOLATION,
    ComplaintOutcome.INSUFFICIENT_EVIDENCE,
}


# MODELS

class Complaint(models.Model):
    """
    Main complaint record.

    PRIMARY ANCHORS (always set, never null):
      - booking_item: the completed BookingItem that gives the complainant standing
      - booking: denormalized parent Booking for admin filtering

    AUTO-INFERRED (set by service layer, not client):
      - listing / package: copied from booking_item.listing / booking_item.package
      - complaint_against_user: the other party (host if traveller filed, traveller if host filed)

    PRIVACY:
      - Complainant always sees their own complaint
      - Respondent sees complaint only after status reaches AWAITING_RESPONDENT
      - Admin sees everything including internal_notes
      - is_sensitive restricts what the respondent can see (description hidden)
    """

    # primary anchors
    booking_item = models.ForeignKey(
        'bookings.BookingItem',
        on_delete=models.PROTECT,
        related_name='complaints',
    )
    booking = models.ForeignKey(
        'bookings.Booking',
        on_delete=models.CASCADE,
        related_name='complaints',
    )

    # who filed 
    filed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='filed_complaints',
    )
    filed_by_role = models.CharField(
        max_length=20,
        choices=FiledByRole.choices,
    )

    # auto-inferred target (set by service, not client)
    listing = models.ForeignKey(
        'listings.Listing',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='complaints',
    )
    package = models.ForeignKey(
        'packages.Package',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='complaints',
    )
    complaint_against_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='complaints_against',
    )

    # complaint content
    category = models.CharField(
        max_length=50,
        choices=ComplaintCategory.choices,
        db_index=True,
    )
    title = models.CharField(max_length=255)
    description = models.TextField()

    # severity
    severity = models.CharField(
        max_length=20,
        choices=ComplaintSeverity.choices,
        db_index=True,
    )
    severity_overridden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='+',
    )
    severity_override_reason = models.TextField(blank=True)

    # workflow status 
    status = models.CharField(
        max_length=30, 
        choices=ComplaintStatus.choices,
        default=ComplaintStatus.SUBMITTED,
        db_index=True,
    )

    # outcome (set when status reaches RESOLVED or REJECTED)
    outcome = models.CharField(
        max_length=30,
        choices=ComplaintOutcome.choices,
        blank=True,
    )
    outcome_recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='+',
    )
    outcome_recorded_at = models.DateTimeField(null=True, blank=True)
    resolution_note = models.TextField(blank=True)

    # flags
    is_sensitive = models.BooleanField(
        default=False,
        help_text="Auto-set for sensitive categories. Limits disclosure to respondent.",
    )
    requires_evidence = models.BooleanField(
        default=False,
        help_text="True when category requires complainant to upload evidence before triage.",
    )
    complainant_evidence_submitted = models.BooleanField(
        default=False,
        help_text="Flipped to True when complainant uploads at least one evidence file.",
    )

    # admin-only fields
    internal_notes = models.TextField(blank=True)
    admin_summary_for_respondent = models.TextField(
        blank=True,
        help_text="For sensitive complaints: admin writes a sanitised summary that the respondent sees instead of the raw description.",
    )
    protective_action = models.TextField(blank=True)
    protective_action_recorded_at = models.DateTimeField(null=True, blank=True)

    # timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    triaged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta: 
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['filed_by', 'status']),
            models.Index(fields=['complaint_against_user', 'status']),
            models.Index(fields=['booking', 'status']),
            models.Index(fields=['status', 'severity']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['category', 'status']),
        ]

        constraints = [
            # listing XOR package: at most one set, both null is valid
            models.CheckConstraint(
                check=(
                    models.Q(listing__isnull=True, package__isnull=True) |
                    models.Q(listing__isnull=False, package__isnull=True) |
                    models.Q(listing__isnull=True, package__isnull=False)
                ),
                name='complaint_listing_xor_package',
            ),
            # One active complaint per booking item per filer.
            # Historical resolved/rejected/closed complaints may coexist.
            models.UniqueConstraint(
                fields=['booking_item', 'filed_by'],
                condition=models.Q(status__in=ACTIVE_COMPLAINT_STATUSES),
                name='unique_active_complaint_per_booking_item_filer',
            ),
        ]

    def __str__(self):
        return f"Complaint #{self.pk} [{self.category}] by {self.filed_by_id}"


class ComplaintEvidence(models.Model):
    """
    File attachment for a complaint.

    Supports images (JPEG, PNG) and documents (PDF).

    Multiple evidence files per complaint.

    uploaded_by tracks whether this is complainant evidence or respondent counter-evidence.
    """
    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='evidences',
    )
    file = models.FileField(upload_to='complaints/evidence/')
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(help_text="Bytes")
    file_type = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['complaint', 'created_at']),
        ]
    
    def __str__(self):
        return f"Evidence #{self.pk} for Complaint #{self.complaint_id}"
    

class ComplaintResponse(models.Model):
    """
    Respondent's reply to a complaint. OneToOneField enforces one response per complaint.

    MVP limitation: only one response is allowed. If multi-round conversation is needed
    in future, change this to ForeignKey and add a sequence/round field.

    is_visible_to_complainant: admin can toggle this to False for sensitive cases
    where the respondent's reply should not be shared back to the complainant.
    """

    complaint = models.OneToOneField(
        Complaint,
        on_delete=models.CASCADE,
        related_name='response',
    )
    responded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='+',
    )
    body = models.TextField()
    is_visible_to_complainant = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Response to Complaint #{self.complaint_id}"


class ComplaintEvent(models.Model):
    """
    Immutable audit trail. One row per action taken on a complaint.
    Mirrors the ReviewEvent pattern.
    """

    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='events',
    )
    event_type = models.CharField(
        max_length=50,
        choices=ComplaintEventType.choices,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='+',
    )
    actor_role = models.CharField(max_length=20)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['complaint', 'event_type']),
        ]

    def __str__(self):
        return f"{self.event_type} on Complaint #{self.complaint_id}"
