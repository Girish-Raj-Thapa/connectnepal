from django.contrib import admin
from .models import Complaint, ComplaintEvidence, ComplaintResponse, ComplaintEvent


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'filed_by', 'filed_by_role', 'category', 'severity',
        'status', 'outcome', 'is_sensitive', 'created_at',
    )
    list_filter = ('category', 'severity', 'status', 'outcome', 'filed_by_role', 'is_sensitive')
    search_fields = ('filed_by__email', 'title', 'description')
    readonly_fields = (
        'created_at', 'updated_at', 'triaged_at', 'resolved_at',
        'outcome_recorded_at', 'protective_action_recorded_at',
    )
    raw_id_fields = (
        'booking_item', 'booking', 'filed_by', 'listing', 'package',
        'complaint_against_user', 'severity_overridden_by', 'outcome_recorded_by',
    )


@admin.register(ComplaintEvidence)
class ComplaintEvidenceAdmin(admin.ModelAdmin):
    list_display = ('id', 'complaint', 'file_name', 'file_type', 'file_size', 'uploaded_by', 'created_at')
    list_filter = ('file_type',)
    search_fields = ('complaint__id', 'file_name')
    readonly_fields = ('created_at',)
    raw_id_fields = ('complaint', 'uploaded_by')


@admin.register(ComplaintResponse)
class ComplaintResponseAdmin(admin.ModelAdmin):
    list_display = ('id', 'complaint', 'responded_by', 'is_visible_to_complainant', 'created_at')
    list_filter = ('is_visible_to_complainant',)
    search_fields = ('complaint__id', 'responded_by__email')
    readonly_fields = ('created_at', 'updated_at')
    raw_id_fields = ('complaint', 'responded_by')


@admin.register(ComplaintEvent)
class ComplaintEventAdmin(admin.ModelAdmin):
    list_display = ('id', 'complaint', 'event_type', 'actor', 'actor_role', 'created_at')
    list_filter = ('event_type', 'actor_role')
    search_fields = ('complaint__id',)
    readonly_fields = ('created_at',)
    raw_id_fields = ('complaint', 'actor')