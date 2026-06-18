from django.contrib import admin
from django.db.models import Count, Q

from .models import TripPlanner, TripPlannerItem


class TripPlannerItemInline(admin.TabularInline):
    """Inline admin for trip planner items."""
    model = TripPlannerItem
    extra = 0
    ordering = ('day_number', 'order')
    autocomplete_fields = ('listing',)
    readonly_fields = (
        'price_snapshot',
        'duration_type_snapshot',
        'duration_days_snapshot',
        'duration_nights_snapshot',
        'duration_hours_snapshot',
        'removed_at',
        'removal_reason',
        'added_at',
    )
    fields = (
        'day_number',
        'order',
        'listing',
        'price_snapshot',
        'duration_type_snapshot',
        'duration_days_snapshot',
        'duration_nights_snapshot',
        'duration_hours_snapshot',
        'removed_at',
        'removal_reason',
        'notes',
        'added_at',
    )


@admin.register(TripPlanner)
class TripPlannerAdmin(admin.ModelAdmin):
    """Admin configuration for TripPlanner model."""

    list_display = (
        'title',
        'traveller',
        'status',
        'total_days',
        'travellers_count',
        'estimated_cost',
        'item_count',
        'start_date',
        'end_date',
        'updated_at',
    )

    list_filter = (
        'status',
        'start_date',
        'end_date',
        'created_at',
        'updated_at',
    )

    search_fields = (
        'title',
        'traveller__email',
        'traveller__first_name',
        'traveller__last_name',
    )

    readonly_fields = (
        'estimated_cost',
        'created_at',
        'updated_at',
    )

    fieldsets = (
        ('Owner & Status', {
            'fields': ('traveller', 'status')
        }),
        ('Trip Details', {
            'fields': (
                'title',
                'start_date',
                'end_date',
                'total_days',
                'travellers_count',
                'estimated_cost',
            )
        }),
        ('Media', {
            'fields': ('cover_image',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    inlines = [TripPlannerItemInline]
    ordering = ('-updated_at',)
    autocomplete_fields = ('traveller',)
    list_select_related = ('traveller',)

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.annotate(
            item_count=Count('items', filter=Q(items__removed_at__isnull=True))
        )

    def item_count(self, obj):
        return obj.item_count

    item_count.short_description = 'Items'
    item_count.admin_order_field = 'item_count'


@admin.register(TripPlannerItem)
class TripPlannerItemAdmin(admin.ModelAdmin):
    """Admin configuration for TripPlannerItem model."""

    list_display = (
        'trip_planner',
        'day_number',
        'order',
        'listing',
        'removed_at',
        'removal_reason',
        'price_snapshot',
        'added_at',
    )

    list_filter = (
        'day_number',
        'trip_planner__status',
    )

    search_fields = (
        'trip_planner__title',
        'trip_planner__traveller__email',
        'listing__title',
    )

    readonly_fields = (
        'price_snapshot',
        'duration_type_snapshot',
        'duration_days_snapshot',
        'duration_nights_snapshot',
        'duration_hours_snapshot',
        'removed_at',
        'removal_reason',
        'added_at',
    )

    ordering = ('trip_planner', 'day_number', 'order')
    autocomplete_fields = ('trip_planner', 'listing')
