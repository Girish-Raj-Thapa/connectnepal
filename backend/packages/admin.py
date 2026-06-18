from django.contrib import admin

from packages.models import Package, PackageListing


class PackageListingInline(admin.TabularInline):
    model = PackageListing
    extra = 0
    ordering = ["sort_order"]
    fields = ["listing", "sort_order", "day_number", "notes"]


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = [
        "title", "host", "total_price",
        "is_bookable", "is_active", "booking_count", "created_at",
    ]
    search_fields = ["title", "host__business_name", "host__user__email"]
    list_filter = ["is_active", "is_bookable"]
    readonly_fields = ["slug", "booking_count", "created_at", "updated_at"]
    fieldsets = [
        ("Identity",   {"fields": ["host", "title", "slug", "description"]}),
        ("Duration",   {"fields": ["duration_days", "duration_nights"]}),
        ("Pricing",    {"fields": ["total_price", "discount_label"]}),
        ("Capacity",   {"fields": ["max_group_size", "max_bookings"]}),
        ("Content",    {"fields": ["tags", "inclusions", "highlights", "terms_and_conditions", "cover_image"]}),
        ("Validity",   {"fields": ["valid_from", "valid_until"]}),
        ("Lifecycle",  {"fields": ["is_bookable", "is_active", "booking_count"]}),
        ("Timestamps", {"fields": ["created_at", "updated_at"]}),
    ]
    inlines = [PackageListingInline]
