from django.contrib import admin
from .models import Listing, ListingImage


class ListingImageInline(admin.TabularInline):
    """Inline admin for listing images."""
    model = ListingImage
    extra = 1
    readonly_fields = ('uploaded_at',)
    fields = ('image', 'is_primary', 'caption', 'order', 'uploaded_at')


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    """Admin configuration for Listing model."""

    list_display = (
        'title',
        'host',
        'category',
        'price_per_person',
        'rating_average',
        'is_active',
        'created_at',
    )

    list_filter = (
        'category',
        'activity_type',
        'difficulty_level',
        'is_active',
        'instant_booking',
    )

    search_fields = (
        'title',
        'description',
        'destination',
        'host__user__email',
        'host__business_name',
    )

    readonly_fields = (
        'slug',
        'average_duration_hours',
        'rating_average',
        'rating_count',
        'created_at',
        'updated_at',
    )

    fieldsets = (
        ('Basic Information', {
            'fields': ('host', 'title', 'slug', 'description', 'destination', 'location')
        }),
        ('Classification', {
            'fields': ('category', 'activity_type', 'difficulty_level', 'ideal_for')
        }),
        ('Pricing & Duration', {
            'fields': ('price_per_person', 'duration_days', 'duration_nights', 'average_duration_hours')
        }),
        ('Group Size', {
            'fields': ('min_group_size', 'max_group_size')
        }),
        ('Availability', {
            'fields': ('is_bookable', 'instant_booking', 'best_seasons')
        }),
        ('Practical Information', {
            'fields': ('what_to_bring', 'requirements', 'inclusions', 'exclusions', 'cancellation_policy', 'languages_offered')
        }),
        ('Metadata', {
            'fields': ('tags',)
        }),
        ('Ratings', {
            'fields': ('rating_average', 'rating_count')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    inlines = [ListingImageInline]

    ordering = ('-created_at',)


@admin.register(ListingImage)
class ListingImageAdmin(admin.ModelAdmin):
    """Admin configuration for ListingImage model."""

    list_display = ('listing', 'is_primary', 'order', 'uploaded_at')
    list_filter = ('is_primary',)
    search_fields = ('listing__title', 'caption')
    readonly_fields = ('uploaded_at',)
