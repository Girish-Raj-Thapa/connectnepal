from django.contrib import admin

from pages.models import Page, FAQCategory, FAQItem


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "slug",
        "kind",
        "is_active",
        "show_in_footer",
        "show_in_chatbot",
        "sort_order",
        "updated_at",
    )
    list_filter = (
        "kind",
        "is_active",
        "show_in_footer",
        "show_in_chatbot",
    )
    search_fields = ("title", "slug", "content")
    ordering = ("kind", "sort_order", "title")
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("created_at", "updated_at")
    list_editable = ("is_active", "show_in_footer", "show_in_chatbot", "sort_order")
    fieldsets = (
        ("Core", {"fields": ("title", "slug", "kind", "content")}),
        (
            "Visibility",
            {
                "fields": (
                    "is_active",
                    "show_in_footer",
                    "show_in_chatbot",
                    "sort_order",
                )
            },
        ),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(FAQCategory)
class FAQCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    ordering = ("name",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(FAQItem)
class FAQItemAdmin(admin.ModelAdmin):
    list_display = (
        "question",
        "category",
        "is_active",
        "show_publicly",
        "show_in_chatbot",
        "sort_order",
        "updated_at",
    )
    list_filter = (
        "category",
        "is_active",
        "show_publicly",
        "show_in_chatbot",
    )
    search_fields = (
        "question",
        "answer",
        "category__name",
        "category__slug",
    )
    ordering = ("category__name", "sort_order", "question")
    list_select_related = ("category",)
    list_editable = ("is_active", "show_publicly", "show_in_chatbot", "sort_order")
    readonly_fields = ("created_at", "updated_at")
