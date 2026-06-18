from rest_framework import serializers
from .models import PaymentAttempt, Payment


# ============================================================================
# INPUT SERIALIZERS
# ============================================================================

class EsewaInitiateInputSerializer(serializers.Serializer):
    """
    Input for POST /api/payments/esewa/initiate/
    """
    booking_id = serializers.IntegerField(min_value=1)


# ============================================================================
# OUTPUT SERIALIZERS
# ============================================================================

class EsewaFormFieldsSerializer(serializers.Serializer):
    """
    Nested: the complete set of eSewa v2 form POST fields.
    """
    amount = serializers.CharField()
    tax_amount = serializers.CharField()
    total_amount = serializers.CharField()
    transaction_uuid = serializers.CharField()
    product_code = serializers.CharField()
    product_service_charge = serializers.CharField()
    product_delivery_charge = serializers.CharField()
    success_url = serializers.CharField()
    failure_url = serializers.CharField()
    signed_field_names = serializers.CharField()
    signature = serializers.CharField()


class EsewaInitiateResponseSerializer(serializers.Serializer):
    """
    Response for POST /api/payments/esewa/initiate/

    The frontend uses:
    - attempt_id: to poll status and navigate to success/failure pages
    - form_url: the eSewa hosted payment page URL
    - fields: all hidden form fields to POST to form_url
    """
    attempt_id = serializers.IntegerField()
    form_url = serializers.CharField()
    fields = EsewaFormFieldsSerializer()


class PaymentAttemptStatusSerializer(serializers.ModelSerializer):
    """
    Response for GET /api/payments/attempts/<id>/status/ (polling endpoint).
    """
    booking_id = serializers.IntegerField(source="booking.id", read_only=True)

    class Meta:
        model = PaymentAttempt
        fields = [
            "id",
            "status",
            "booking_id",
            "provider",
            "created_at",
            "verified_at",
        ]


class PaymentSerializer(serializers.ModelSerializer):
    """
    Response for GET /api/payments/<id>/ (payment detail / receipt page).
    """
    booking_id = serializers.IntegerField(source="booking.id", read_only=True)
    booking_reference = serializers.CharField(
        source="booking.reference", read_only=True
    )

    class Meta:
        model = Payment
        fields = [
            "id",
            "booking_id",
            "booking_reference",
            "amount",
            "provider",
            "gateway_transaction_code",
            "paid_at",
            "created_at",
        ]
