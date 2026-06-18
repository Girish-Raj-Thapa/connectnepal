from django.contrib import admin

from notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "recipient",
        "actor",
        "notification_type",
        "priority",
        "title",
        "is_read",
        "is_archived",
        "created_at",
    )
    list_filter = (
        "notification_type",
        "priority",
        "is_read",
        "is_archived",
        "created_at",
    )
    search_fields = (
        "title",
        "body",
        "recipient__email",
        "actor__email",
        "dedupe_key",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "read_at",
        "archived_at",
    )
    ordering = ("-created_at",)
    autocomplete_fields = ("recipient", "actor")
    list_select_related = ("recipient", "actor")
    date_hierarchy = "created_at"

    fieldsets = (
        (
            "Users",
            {
                "fields": ("recipient", "actor"),
            },
        ),
        (
            "Content",
            {
                "fields": (
                    "notification_type",
                    "priority",
                    "title",
                    "body",
                    "action_url",
                    "image_url",
                    "metadata",
                    "dedupe_key",
                ),
            },
        ),
        (
            "State",
            {
                "fields": (
                    "is_read",
                    "read_at",
                    "is_archived",
                    "archived_at",
                ),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
            },
        ),
    )
