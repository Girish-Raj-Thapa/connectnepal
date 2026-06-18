from django.contrib import admin
from .models import PaymentAttempt, Payment


@admin.register(PaymentAttempt)
class PaymentAttemptAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "booking",
        "user",
        "provider",
        "status",
        "expected_amount",
        "transaction_uuid",
        "created_at",
        "verified_at",
    ]
    list_filter = ["status", "provider", "created_at"]
    search_fields = [
        "transaction_uuid",
        "booking__reference",
        "user__email",
        "gateway_transaction_code",
    ]
    readonly_fields = [
        "id",
        "booking",
        "user",
        "provider",
        "transaction_uuid",
        "expected_amount",
        "amount_str",
        "gateway_transaction_code",
        "raw_response",
        "created_at",
        "updated_at",
        "verified_at",
    ]
    ordering = ["-created_at"]
    fieldsets = [
        ("Attempt Info", {
            "fields": [
                "id", "booking", "user", "provider", "status",
                "transaction_uuid", "expected_amount", "amount_str",
            ],
        }),
        ("Gateway Response", {
            "fields": [
                "gateway_transaction_code", "raw_response", "failure_reason",
            ],
        }),
        ("Timestamps", {
            "fields": ["created_at", "updated_at", "verified_at"],
        }),
    ]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "booking",
        "user",
        "provider",
        "amount",
        "gateway_transaction_code",
        "paid_at",
        "created_at",
    ]
    list_filter = ["provider", "created_at"]
    search_fields = [
        "gateway_transaction_code",
        "booking__reference",
        "user__email",
    ]
    readonly_fields = [
        "id",
        "attempt",
        "booking",
        "user",
        "provider",
        "amount",
        "gateway_transaction_code",
        "paid_at",
        "created_at",
    ]
    ordering = ["-created_at"]