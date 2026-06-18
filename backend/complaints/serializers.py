from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from accounts.models import Account
from bookings.models import BookingItem, BookingItemStatus

from .models import (
    Complaint, ComplaintEvidence, ComplaintResponse, ComplaintEvent,
    ComplaintCategory, ComplaintSeverity, ComplaintStatus, ComplaintOutcome,
    FiledByRole, REPORTING_WINDOW_DAYS, ACTIVE_COMPLAINT_STATUSES,
)


# CONSTANTS

EVIDENCE_MAX_BYTES = 2 * 1024 * 1024 # 2 MB

EVIDENCE_ALLOWED_CONTENT_TYPES = {
    'image/jpeg',
    'image/png',
}


# INPUT: CREATE COMPLAINT

class ComplaintCreateSerializer(serializers.Serializer):
    """
    POST /api/complaints/ (traveller) or POST /api/host/complaints/ (host)

    Accepts booking_item_id, category, title, description.

    Validates:
    - booking_item exists and is COMPLETED
    - complainant owns the booking item (traveller owns booking, or host owns listing/package)
    - reporting window has not closed for the chosen category
    - booking_item has listing or package (data integrity)

    Sets in validated_data:
    - booking_item (resolved instance)
    - filed_by_role (FiledByRole value)
    - category, title, description (pass-through)
    """
    booking_item_id = serializers.PrimaryKeyRelatedField(
        queryset=BookingItem.objects.select_related(
            'booking', 'listing', 'listing__host', 'package', 'package__host',
        ),
    )
    category = serializers.ChoiceField(choices=ComplaintCategory.choices)
    title = serializers.CharField(max_length=255, min_length=10)
    description = serializers.CharField(min_length=20)

    def validate(self, attrs):
        user = self.context['request'].user
        booking_item = attrs['booking_item_id']
        category = attrs['category']

        # booking item must be COMPLETED ──
        if booking_item.status != BookingItemStatus.COMPLETED:
            raise serializers.ValidationError(
                {"booking_item_id": "Booking item must be completed before filing a complaint."}
            )
        
        # completion timestamp must exist
        if not booking_item.completed_at:
            raise serializers.ValidationError(
                {"booking_item_id": "Booking item completion timestamp is missing."}
            )

        # booking item must reference exactly one target (XOR)
        has_listing = bool(booking_item.listing_id)
        has_package = bool(booking_item.package_id)
        if has_listing and has_package:
            raise serializers.ValidationError(
                {"booking_item_id": "Booking item references both a listing and a package. Exactly one is required."}
            )
        if not has_listing and not has_package:
            raise serializers.ValidationError(
                {"booking_item_id": "Booking item does not reference a listing or package."}
            )

        # determine filer role and validate ownership
        if user.role == Account.Role.TRAVELLER:
            if booking_item.booking.traveller_id != user.id:
                raise serializers.ValidationError(
                    {"booking_item_id": "You can only file complaints for your own bookings."}
                )
            attrs['filed_by_role'] = FiledByRole.TRAVELLER

        elif user.role == Account.Role.HOST:
            try:
                host_detail = user.host_detail
            except Exception:
                raise serializers.ValidationError(
                    {"detail": "Host profile not found."}
                )
            is_owned = False
            if has_listing and booking_item.listing.host_id == host_detail.pk:
                is_owned = True
            if has_package and booking_item.package.host_id == host_detail.pk:
                is_owned = True
            if not is_owned:
                raise serializers.ValidationError(
                    {"booking_item_id": "You can only file complaints for bookings on your own listings or packages."}
                )
            attrs['filed_by_role'] = FiledByRole.HOST

        else:
            raise serializers.ValidationError(
                {"detail": "Only travellers and hosts can file complaints."}
            )

        # one active complaint per booking item per user
        if Complaint.objects.filter(
            booking_item=booking_item,
            filed_by=user,
            status__in=ACTIVE_COMPLAINT_STATUSES,
        ).exists():
            raise serializers.ValidationError(
                {"booking_item_id": "You already have an active complaint for this booking item."}
            )

        # reporting window check
        window_days = REPORTING_WINDOW_DAYS.get(category, 30)
        deadline = booking_item.completed_at + timedelta(days=window_days)
        if timezone.now() > deadline:
            raise serializers.ValidationError(
                {"category": f"The reporting window for '{category}' ({window_days} days after completion) has closed."}
            )

        # rename key for service layer
        attrs['booking_item'] = attrs.pop('booking_item_id')

        return attrs
    

# INPUT: EVIDENCE UPLOAD 

class EvidenceUploadSerializer(serializers.Serializer):
    """
    POST .../evidence/

    Validates file size and content type.
    """
    file = serializers.FileField()
    description = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_file(self, value):
        if value.size > EVIDENCE_MAX_BYTES:
            raise serializers.ValidationError(
                f"File size exceeds {EVIDENCE_MAX_BYTES // (1024 * 1024)} MB limit."
            )
        content_type = getattr(value, 'content_type', '')
        if content_type not in EVIDENCE_ALLOWED_CONTENT_TYPES:
            raise serializers.ValidationError(
                f"File type '{content_type}' is not allowed. Allowed: JPEG, PNG"
            )
        return value


# INPUT: RESPONDENT RESPONSE

class ResponseSubmitSerializer(serializers.Serializer):
    """
    POST .../respond/
    """
    body = serializers.CharField(min_length=20)


# INPUT: ADMIN MODERATION

class AdminModerateSerializer(serializers.Serializer):
    """
    POST /api/admin/complaints/{pk}/moderate/

    action-based moderation matching ReviewModerateSerializer pattern.
    """
    action = serializers.ChoiceField(choices=[
        'triage',
        'request_info',
        'send_to_respondent',
        'begin_review',
        'escalate',
        'retriage',
        'close',
    ])
    note = serializers.CharField(required=False, allow_blank=True, default='')
    summary_for_respondent = serializers.CharField(required=False, allow_blank=True, default='')


class AdminSeveritySerializer(serializers.Serializer):
    """
    PATCH /api/admin/complaints/{pk}/severity/
    """
    severity = serializers.ChoiceField(choices=ComplaintSeverity.choices)
    reason = serializers.CharField(required=False, allow_blank=True, default='')


class AdminOutcomeSerializer(serializers.Serializer):
    """
    POST /api/admin/complaints/{pk}/record-outcome/
    """
    outcome = serializers.ChoiceField(choices=ComplaintOutcome.choices)
    resolution_note = serializers.CharField(min_length=10)
    protective_action = serializers.CharField(required=False, allow_blank=True, default='')


# OUTPUT: EVIDENCE 

class EvidenceReadSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    uploader_name = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintEvidence
        fields = [
            'id', 'file_url', 'file_name', 'file_size', 'file_type',
            'description', 'uploader_name', 'uploaded_by', 'created_at',
        ]
        read_only_fields = fields

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None

    def get_uploader_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.full_name
        return None


# OUTPUT: RESPONSE 

class ResponseReadSerializer(serializers.ModelSerializer):
    respondent_name = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintResponse
        fields = [
            'id', 'respondent_name', 'body',
            'is_visible_to_complainant', 'created_at',
        ]
        read_only_fields = fields

    def get_respondent_name(self, obj):
        if obj.responded_by:
            return obj.responded_by.full_name
        return None


# OUTPUT: EVENT

class EventReadSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintEvent
        fields = [
            'id', 'event_type', 'actor_name', 'actor_role',
            'payload', 'created_at',
        ]
        read_only_fields = fields

    def get_actor_name(self, obj):
        if obj.actor:
            return obj.actor.full_name
        return "System"


class ComplaintTargetSnapshotMixin:
    def _get_snapshot(self, obj):
        booking_item = getattr(obj, "booking_item", None)
        snapshot = getattr(booking_item, "snapshot", None)
        return snapshot if isinstance(snapshot, dict) else {}

    def get_listing_title(self, obj):
        if not obj.listing_id:
            return None
        snapshot = self._get_snapshot(obj)
        return snapshot.get("title") or (obj.listing.title if obj.listing else None)

    def get_package_title(self, obj):
        if not obj.package_id:
            return None
        snapshot = self._get_snapshot(obj)
        return snapshot.get("package_title") or (obj.package.title if obj.package else None)

    def get_target_label(self, obj):
        listing_title = self.get_listing_title(obj)
        if listing_title:
            return f"Listing: {listing_title}"

        package_title = self.get_package_title(obj)
        if package_title:
            return f"Package: {package_title}"

        return "N/A"


# OUTPUT: COMPLAINT LIST (lightweight, used by all roles)

class ComplaintListSerializer(ComplaintTargetSnapshotMixin, serializers.ModelSerializer):
    """
    Lightweight list serializer. Expects queryset to be annotated with event_count and evidence_count (set in the view's get_queryset).
    """
    filer_name = serializers.SerializerMethodField()
    target_label = serializers.SerializerMethodField()
    event_count = serializers.IntegerField(read_only=True)
    evidence_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Complaint
        fields = [
            'id', 'category', 'title', 'severity', 'status',
            'filer_name', 'filed_by_role', 'target_label',
            'event_count', 'evidence_count',
            'created_at',
        ]
        read_only_fields = fields

    def get_filer_name(self, obj):
        if obj.filed_by:
            return obj.filed_by.full_name
        return None


# OUTPUT: COMPLAINT DETAIL — COMPLAINANT VIEW

class ComplaintDetailSerializer(ComplaintTargetSnapshotMixin, serializers.ModelSerializer):
    """
    Full detail for the complainant. Shows everything except internal_notes and admin_summary_for_respondent.
    """
    filer_name = serializers.SerializerMethodField()
    respondent_name = serializers.SerializerMethodField()
    booking_reference = serializers.CharField(source='booking.reference', read_only=True)
    listing_title = serializers.SerializerMethodField()
    package_title = serializers.SerializerMethodField()
    evidences = EvidenceReadSerializer(many=True, read_only=True)
    events = EventReadSerializer(many=True, read_only=True)
    response = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = [
            'id',
            'booking_item', 'booking', 'booking_reference',
            'filed_by', 'filer_name', 'filed_by_role',
            'complaint_against_user', 'respondent_name',
            'listing', 'listing_title', 'package', 'package_title',
            'category', 'title', 'description',
            'severity', 'status',
            'is_sensitive', 'requires_evidence', 'complainant_evidence_submitted',
            'outcome', 'resolution_note',
            'protective_action',
            'created_at', 'updated_at', 'triaged_at', 'resolved_at',
            'evidences', 'events', 'response',
        ]
        read_only_fields = fields

    def get_filer_name(self, obj):
        return obj.filed_by.full_name if obj.filed_by else None

    def get_respondent_name(self, obj):
        return obj.complaint_against_user.full_name if obj.complaint_against_user else None

    def get_response(self, obj):
        try:
            resp = obj.response
        except ComplaintResponse.DoesNotExist:
            return None
        if not resp.is_visible_to_complainant:
            return None
        return ResponseReadSerializer(resp).data


# OUTPUT: COMPLAINT DETAIL — RESPONDENT VIEW

class ComplaintRespondentDetailSerializer(ComplaintTargetSnapshotMixin, serializers.ModelSerializer):
    """
    Restricted detail for the respondent.

    For sensitive complaints:
      - description is replaced with admin_summary_for_respondent.
      - evidences are filtered to only show the respondent's own uploads.
    For normal complaints: full description and all evidence shown.

    Internal notes and protective action are never shown.
    """
    filer_name = serializers.SerializerMethodField()
    booking_reference = serializers.CharField(source='booking.reference', read_only=True)
    listing_title = serializers.SerializerMethodField()
    package_title = serializers.SerializerMethodField()
    description_or_summary = serializers.SerializerMethodField()
    evidences = serializers.SerializerMethodField()
    response = serializers.SerializerMethodField()
    can_respond = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = [
            'id',
            'booking_item', 'booking', 'booking_reference',
            'filed_by_role', 'filer_name',
            'listing', 'listing_title', 'package', 'package_title',
            'category', 'title', 'description_or_summary',
            'severity', 'status',
            'is_sensitive',
            'outcome', 'resolution_note',
            'created_at', 'resolved_at',
            'evidences', 'response', 'can_respond',
        ]
        read_only_fields = fields

    def get_filer_name(self, obj):
        return obj.filed_by.full_name if obj.filed_by else None

    def get_description_or_summary(self, obj):
        if obj.is_sensitive:
            return obj.admin_summary_for_respondent or "[Sensitive — summary pending from admin]"
        return obj.description

    def get_evidences(self, obj):
        """
        For sensitive complaints: only show evidence uploaded by the respondent.
        For normal complaints: show all evidence.
        """
        qs = obj.evidences.all()
        if obj.is_sensitive:
            qs = qs.filter(uploaded_by_id=obj.complaint_against_user_id)
        return EvidenceReadSerializer(qs, many=True).data

    def get_response(self, obj):
        try:
            resp = obj.response
        except ComplaintResponse.DoesNotExist:
            return None
        return ResponseReadSerializer(resp).data

    def get_can_respond(self, obj):
        if obj.status != ComplaintStatus.AWAITING_RESPONDENT:
            return False
        try:
            return obj.response is None
        except ComplaintResponse.DoesNotExist:
            return True


# OUTPUT: COMPLAINT DETAIL — ADMIN VIEW

class AdminComplaintDetailSerializer(ComplaintTargetSnapshotMixin, serializers.ModelSerializer):
    """
    Full detail for admin. Includes internal_notes and admin_summary_for_respondent.
    """
    filer_name = serializers.SerializerMethodField()
    respondent_name = serializers.SerializerMethodField()
    booking_reference = serializers.CharField(source='booking.reference', read_only=True)
    listing_title = serializers.SerializerMethodField()
    package_title = serializers.SerializerMethodField()
    evidences = EvidenceReadSerializer(many=True, read_only=True)
    events = EventReadSerializer(many=True, read_only=True)
    response = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = [
            'id',
            'booking_item', 'booking', 'booking_reference',
            'filed_by', 'filer_name', 'filed_by_role',
            'complaint_against_user', 'respondent_name',
            'listing', 'listing_title', 'package', 'package_title',
            'category', 'title', 'description',
            'severity', 'severity_overridden_by', 'severity_override_reason',
            'status',
            'is_sensitive', 'requires_evidence', 'complainant_evidence_submitted',
            'outcome', 'outcome_recorded_by', 'outcome_recorded_at',
            'resolution_note',
            'internal_notes', 'admin_summary_for_respondent',
            'protective_action', 'protective_action_recorded_at',
            'created_at', 'updated_at', 'triaged_at', 'resolved_at',
            'evidences', 'events', 'response',
        ]
        read_only_fields = fields

    def get_filer_name(self, obj):
        return obj.filed_by.full_name if obj.filed_by else None

    def get_respondent_name(self, obj):
        return obj.complaint_against_user.full_name if obj.complaint_against_user else None

    def get_response(self, obj):
        try:
            resp = obj.response
        except ComplaintResponse.DoesNotExist:
            return None
        return ResponseReadSerializer(resp).data
    
