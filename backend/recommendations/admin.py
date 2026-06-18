from django.contrib import admin

from .models import (
    ListingFeatureSnapshot,
    ListingInteractionEvent,
    RecommendationEvent,
    RecommendationModelVersion,
    ServedRecommendationSet,
    UserBehaviorProfileSnapshot,
)


@admin.register(RecommendationModelVersion)
class RecommendationModelVersionAdmin(admin.ModelAdmin):
    list_display = (
        'version_label',
        'is_active',
        'sklearn_version',
        'vector_dimension',
        'created_at',
    )
    list_filter = ('is_active',)
    search_fields = ('version_label', 'notes')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)

    fieldsets = (
        (None, {
            'fields': (
                'version_label',
                'artifact_hash',
                'sklearn_version',
                'vector_dimension',
                'is_active',
            ),
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at',),
        }),
    )

    def save_model(self, request, obj, form, change):
        """
        Ensure only one version is active at a time.
        When activating a version, deactivate all others.
        """
        if obj.is_active:
            RecommendationModelVersion.objects.exclude(pk=obj.pk).update(
                is_active=False
            )
        super().save_model(request, obj, form, change)


@admin.register(ListingFeatureSnapshot)
class ListingFeatureSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        'listing',
        'model_version',
        'vector_type',
        'indexed_at',
    )
    list_filter = ('model_version', 'vector_type')
    search_fields = ('listing__title',)
    readonly_fields = ('indexed_at',)
    raw_id_fields = ('listing', 'model_version')
    ordering = ('-indexed_at',)


@admin.register(UserBehaviorProfileSnapshot)
class UserBehaviorProfileSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'model_version',
        'is_sparse',
        'event_count',
        'distinct_listing_count',
        'rebuilt_at',
    )
    list_filter = ('is_sparse', 'model_version')
    search_fields = ('user__email',)
    readonly_fields = ('rebuilt_at',)
    raw_id_fields = ('user', 'model_version')
    ordering = ('-rebuilt_at',)


@admin.register(ServedRecommendationSet)
class ServedRecommendationSetAdmin(admin.ModelAdmin):
    list_display = (
        'request_id',
        'surface',
        'strategy',
        'result_count',
        'user',
        'model_version',
        'created_at',
    )
    list_filter = ('surface', 'strategy', 'model_version')
    search_fields = ('request_id', 'session_id')
    readonly_fields = ('request_id', 'created_at', 'results_json')
    raw_id_fields = ('user', 'model_version', 'seed_listing')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'

    fieldsets = (
        (None, {
            'fields': ('request_id', 'surface', 'strategy', 'result_count'),
        }),
        ('Context', {
            'fields': ('user', 'session_id', 'model_version', 'seed_listing'),
        }),
        ('Results', {
            'fields': ('results_json',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at',),
        }),
    )


@admin.register(RecommendationEvent)
class RecommendationEventAdmin(admin.ModelAdmin):
    list_display = (
        'event_type',
        'surface',
        'listing',
        'position',
        'user',
        'request_id',
        'created_at',
    )
    list_filter = ('event_type', 'surface', 'strategy')
    search_fields = ('request_id', 'session_id')
    readonly_fields = ('created_at',)
    raw_id_fields = ('user', 'listing', 'served_set')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'

    fieldsets = (
        (None, {
            'fields': ('event_type', 'surface', 'strategy', 'position'),
        }),
        ('Identity', {
            'fields': ('user', 'session_id', 'request_id', 'served_set'),
        }),
        ('Content', {
            'fields': ('listing', 'model_version_label', 'metadata'),
        }),
        ('Timestamps', {
            'fields': ('created_at',),
        }),
    )


@admin.register(ListingInteractionEvent)
class ListingInteractionEventAdmin(admin.ModelAdmin):
    list_display = (
        'event_type',
        'surface',
        'listing',
        'position',
        'user',
        'created_at',
    )
    list_filter = ('event_type', 'surface')
    search_fields = ('user__email',)
    readonly_fields = ('created_at',)
    raw_id_fields = ('user', 'listing')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'

    fieldsets = (
        (None, {
            'fields': ('event_type', 'surface', 'position'),
        }),
        ('Identity', {
            'fields': ('user',),
        }),
        ('Content', {
            'fields': ('listing', 'metadata'),
        }),
        ('Timestamps', {
            'fields': ('created_at',),
        }),
    )
    
