from datetime import date

from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from packages.models import PackageSlot, PackageSchedule, PackageSlotException


# HOST - SLOT 

class PackageSlotSerializer(serializers.ModelSerializer):
    """
    Full slot detail for host responses (GET list + detail, POST 201).

    Includes booked_count and available_capacity computed from live BookingItems.
    """
    booked_count = serializers.SerializerMethodField(
        help_text="Active (non-expired) traveller count on this slot.",
    )
    available_capacity = serializers.SerializerMethodField()

    class Meta:
        model = PackageSlot
        fields = [
            "id",
            "package",
            "start_date",
            "end_date",
            "capacity",
            "booked_count",
            "available_capacity",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_booked_count(self, obj):
        from bookings.models import BookingItem, BookingItemStatus, BookingStatus
        now = timezone.now()
        return (
            BookingItem.objects
            .filter(
                package_slot=obj,
                status__in=[
                    BookingItemStatus.PENDING_PAYMENT,
                    BookingItemStatus.CONFIRMED,
                ],
            )
            .exclude(booking__expires_at__lt=now)
            .exclude(booking__status=BookingStatus.EXPIRED)
            .aggregate(total=Sum("traveller_count"))["total"] or 0
        )
    
    def get_available_capacity(self, obj):
        return max(obj.capacity - self.get_booked_count(obj), 0)
    

class PackageSlotCreateSerializer(serializers.Serializer):
    """
    Input for POST /api/host/packages/{id}/slots/
    """
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    capacity = serializers.IntegerField(min_value=1)
    is_active = serializers.BooleanField(default=True)

    def validate(self, attrs):
        if attrs["start_date"] > attrs["end_date"]:
            raise serializers.ValidationError(
                {"end_date": "end_date must be on or after start_date."}
            )
        return attrs


class PackageSlotUpdateSerializer(serializers.Serializer):
    """
    Input for PATCH /api/host/packages/{id}/slots/{slot_id}/
    """
    end_date = serializers.DateField(required=False)
    capacity = serializers.IntegerField(min_value=1, required=False)
    is_active = serializers.BooleanField(required=False)


# HOST - SCHEDULE

class PackageScheduleSerializer(serializers.ModelSerializer):
    """
    Full schedule detail for host responses.
    """
    class Meta:
        model = PackageSchedule
        fields = [
            "id",
            "package",
            "days_of_week",
            "capacity",
            "advance_days",
            "valid_from",
            "valid_until",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PackageScheduleCreateSerializer(serializers.Serializer):
    """
    Input for POST /api/host/packages/{id}/schedules/
    """
    days_of_week = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=6),
        min_length=1,
        max_length=7,
    )
    capacity = serializers.IntegerField(min_value=1)
    advance_days = serializers.IntegerField(min_value=1, max_value=365, default=90)
    valid_from = serializers.DateField(required=False, allow_null=True)
    valid_until = serializers.DateField(required=False, allow_null=True)
    is_active = serializers.BooleanField(default=True)

    def validate_days_of_week(self, value):
        if len(set(value)) != len(value):
            raise serializers.ValidationError("days_of_week must not contain duplicates.")
        return value
    
    def validate(self, attrs):
        valid_from = attrs.get("valid_from")
        valid_until = attrs.get("valid_until")
        if valid_from and valid_until and valid_until < valid_from:
            raise serializers.ValidationError(
                {"valid_until": "valid_until must be on or after valid_from."}
            )
        return attrs


class PackageScheduleUpdateSerializer(serializers.Serializer):
    """
    Input for PATCH /api/host/packages/{id}/schedules/{schedule_id}/
    """
    days_of_week = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=6),
        min_length=1,
        max_length=7,
        required=False,
    )
    capacity = serializers.IntegerField(min_value=1, required=False)
    advance_days = serializers.IntegerField(min_value=1, max_value=365, required=False)
    valid_from = serializers.DateField(required=False, allow_null=True)
    valid_until = serializers.DateField(required=False, allow_null=True)
    is_active = serializers.BooleanField(required=False)


# HOST - EXCEPTION 

class PackageSlotExceptionSerializer(serializers.ModelSerializer):
    """
    Full exception detail for host responses.
    """

    class Meta:
        model = PackageSlotException
        fields = [
            "id",
            "package",
            "date",
            "is_closed",
            "capacity_override",
            "note",
            "created_at",
        ]
        read_only_fields = fields


class PackageSlotExceptionCreateSerializer(serializers.Serializer):
    """
    Input for POST /api/host/packages/{id}/exceptions/
    """
    date = serializers.DateField()
    is_closed = serializers.BooleanField(default=True)
    capacity_override = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("is_closed") and attrs.get("capacity_override") is None:
            raise serializers.ValidationError(
                "Set is_closed=true or provide a capacity_override."
            )
        return attrs


class PackageSlotExceptionUpdateSerializer(serializers.Serializer):
    """
    Input for PATCH /api/host/packages/{id}/exceptions/{exception_id}/
    """
    is_closed = serializers.BooleanField(required=False)
    capacity_override = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True)


# PUBLIC — SLOT + AVAILABILITY 

class PackageSlotPublicSerializer(serializers.ModelSerializer):
    """
    Traveller-facing slot. Omits booked_count; exposes only available_capacity.
    """
    available_capacity = serializers.SerializerMethodField()

    class Meta:
        model = PackageSlot
        fields = [
            "id",
            "start_date",
            "end_date",
            "available_capacity",
        ]
        read_only_fields = fields

    def get_available_capacity(self, obj):
        from bookings.models import BookingItem, BookingItemStatus, BookingStatus
        now = timezone.now()
        booked = (
            BookingItem.objects
            .filter(
                package_slot=obj,
                status__in=[
                    BookingItemStatus.PENDING_PAYMENT,
                    BookingItemStatus.CONFIRMED,
                ],
            )
            .exclude(booking__expires_at__lt=now)
            .exclude(booking__status=BookingStatus.EXPIRED)
            .aggregate(total=Sum("traveller_count"))["total"] or 0
        )
        return max(obj.capacity - booked, 0)
    
    