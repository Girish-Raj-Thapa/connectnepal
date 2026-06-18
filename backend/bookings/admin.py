from django.contrib import admin, messages
from .models import (
    Booking, BookingItem, AvailabilityHold,
    BookingStatusHistory, ProcessedPaymentEvent,
    BookingStatus, PaymentStatus,
)


class BookingItemInline(admin.TabularInline):
    model = BookingItem
    extra = 0
    readonly_fields = [
        "listing", "duration_type", "start_date", "end_date",
        "traveller_count", "status", "quoted_total", "currency",
        "created_at",
    ]
    can_delete = False


class BookingStatusHistoryInline(admin.TabularInline):
    model = BookingStatusHistory
    extra = 0
    readonly_fields = ["booking_item", "from_status", "to_status", "note", "changed_by", "changed_at"]
    can_delete = False


def force_confirm_payment(modeladmin, request, queryset):
    from .services.booking_service import handle_payment_update
    from utils.exceptions import ServiceError

    for booking in queryset:
        if booking.status != BookingStatus.PENDING_PAYMENT:
            modeladmin.message_user(
                request,
                f"{booking.reference}: skipped — status is '{booking.status}', must be pending_payment.",
                level=messages.WARNING,
            )
            continue
        try:
            handle_payment_update(
                booking_id=booking.pk,
                provider="demo",
                payment_intent_ref=f"DEMO-{booking.reference}",
                transaction_id=f"DEMO-{booking.reference}",
                amount=booking.gross_amount,
                currency=booking.currency,
                status=PaymentStatus.PAYMENT_SUCCEEDED,
                event_id=f"DEMO-OVERRIDE-{booking.reference}",
            )
            modeladmin.message_user(
                request,
                f"{booking.reference}: payment confirmed successfully.",
                level=messages.SUCCESS,
            )
        except ServiceError as e:
            modeladmin.message_user(
                request,
                f"{booking.reference}: {e}",
                level=messages.ERROR,
            )

force_confirm_payment.short_description = "Force confirm payment (demo override)"


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = [
        "reference", "traveller", "status", "payment_status",
        "quoted_total", "currency", "source", "created_at",
    ]
    list_filter = ["status", "payment_status", "source", "payment_provider"]
    search_fields = ["reference", "traveller__email", "transaction_id"]
    readonly_fields = [
        "reference", "traveller", "source", "created_at", "updated_at",
        "subtotal", "fee_amount", "tax_amount", "gross_amount", "quoted_total",
    ]
    inlines = [BookingItemInline, BookingStatusHistoryInline]
    ordering = ["-created_at"]
    actions = [force_confirm_payment]


@admin.register(BookingItem)
class BookingItemAdmin(admin.ModelAdmin):
    list_display = [
        "id", "booking", "listing", "status",
        "traveller_count", "start_date", "end_date", "quoted_total",
    ]
    list_filter = ["status", "duration_type"]
    search_fields = ["booking__reference", "listing__title"]
    readonly_fields = ["booking", "listing", "created_at", "updated_at"]


@admin.register(AvailabilityHold)
class AvailabilityHoldAdmin(admin.ModelAdmin):
    list_display  = [
        "id", "listing", "traveller", "start_date", "end_date",
        "expires_at", "is_released",
    ]
    list_filter = ["is_released", "duration_type"]
    search_fields = ["listing__title", "traveller__email"]
    readonly_fields = ["created_at", "released_at"]


@admin.register(ProcessedPaymentEvent)
class ProcessedPaymentEventAdmin(admin.ModelAdmin):
    list_display = ["event_id", "booking", "created_at"]
    search_fields = ["event_id", "booking__reference"]
    readonly_fields = ["event_id", "booking", "created_at"]