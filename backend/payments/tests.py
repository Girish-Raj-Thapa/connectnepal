import base64
import json
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.conf import settings
from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import Account
from bookings.models import Booking, BookingStatus
from payments.models import AttemptStatus, Payment, PaymentAttempt, PaymentProvider
from payments.services.esewa_service import EsewaService
from payments.services.payment_service import PaymentService


@override_settings(ESEWA_PRODUCT_CODE="EPAYTEST", ESEWA_SECRET_KEY="test-secret")
class PaymentServiceHardeningTests(TestCase):
    account_seq = 0

    def create_traveller(self):
        self.__class__.account_seq += 1
        seq = self.__class__.account_seq
        return Account.objects.create(
            email=f"traveller-{seq}@example.com",
            role=Account.Role.TRAVELLER,
            first_name="Test",
            last_name="Traveller",
            is_active=True,
        )

    def create_booking(self, traveller, *, status=BookingStatus.PENDING_PAYMENT, quoted_total="100.00"):
        return Booking.objects.create(
            traveller=traveller,
            status=status,
            expires_at=timezone.now() + timedelta(minutes=15),
            quoted_total=Decimal(quoted_total),
        )

    def create_attempt(self, booking, *, status=AttemptStatus.INITIATED, transaction_uuid, amount_str):
        return PaymentAttempt.objects.create(
            booking=booking,
            user=booking.traveller,
            provider=PaymentProvider.ESEWA,
            transaction_uuid=transaction_uuid,
            expected_amount=booking.quoted_total,
            amount_str=amount_str,
            status=status,
        )

    def build_callback_data(self, attempt, *, transaction_code="TXN-123"):
        payload = {
            "transaction_code": transaction_code,
            "status": "COMPLETE",
            "total_amount": attempt.amount_str,
            "transaction_uuid": attempt.transaction_uuid,
            "product_code": settings.ESEWA_PRODUCT_CODE,
            "signed_field_names": "total_amount,transaction_uuid,product_code",
        }
        message = (
            f"total_amount={payload['total_amount']},"
            f"transaction_uuid={payload['transaction_uuid']},"
            f"product_code={payload['product_code']}"
        )
        payload["signature"] = EsewaService.generate_signature(message)
        return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")

    @patch("bookings.services.booking_service.handle_payment_update")
    @patch("payments.services.payment_service.EsewaService.verify_transaction_status")
    def test_callback_payload_cannot_finalize_different_attempt(
        self,
        mock_verify_transaction_status,
        mock_handle_payment_update,
    ):
        traveller = self.create_traveller()
        booking_a = self.create_booking(traveller, quoted_total="100.00")
        booking_b = self.create_booking(traveller, quoted_total="250.00")
        attempt_a = self.create_attempt(
            booking_a,
            transaction_uuid="attempt-a",
            amount_str="100.00",
        )
        attempt_b = self.create_attempt(
            booking_b,
            transaction_uuid="attempt-b",
            amount_str="250.00",
        )
        encoded_data = self.build_callback_data(attempt_a, transaction_code="TXN-A")

        def verify_status(*, product_code, total_amount, transaction_uuid):
            self.assertEqual(product_code, settings.ESEWA_PRODUCT_CODE)
            self.assertEqual(total_amount, attempt_b.amount_str)
            self.assertEqual(transaction_uuid, attempt_b.transaction_uuid)
            return {
                "status": "NOT_FOUND",
                "ref_id": "",
                "transaction_code": "",
                "total_amount": total_amount,
                "raw": {"status": "NOT_FOUND"},
            }

        mock_verify_transaction_status.side_effect = verify_status

        attempt, success = PaymentService.process_esewa_callback(
            transaction_uuid=attempt_b.transaction_uuid,
            encoded_data=encoded_data,
        )

        attempt_b.refresh_from_db()
        self.assertEqual(attempt.pk, attempt_b.pk)
        self.assertFalse(success)
        self.assertEqual(attempt_b.status, AttemptStatus.FAILED)
        self.assertFalse(Payment.objects.filter(attempt=attempt_b).exists())
        mock_handle_payment_update.assert_not_called()

    @patch("payments.services.payment_service.EsewaService.verify_transaction_status")
    def test_expired_attempt_complete_status_is_marked_for_reconciliation(
        self,
        mock_verify_transaction_status,
    ):
        traveller = self.create_traveller()
        booking = self.create_booking(
            traveller,
            status=BookingStatus.EXPIRED,
            quoted_total="180.00",
        )
        attempt = self.create_attempt(
            booking,
            status=AttemptStatus.EXPIRED,
            transaction_uuid="expired-attempt",
            amount_str="180.00",
        )
        mock_verify_transaction_status.return_value = {
            "status": "COMPLETE",
            "ref_id": "REF-123",
            "transaction_code": "TXN-123",
            "total_amount": attempt.amount_str,
            "raw": {"status": "COMPLETE", "ref_id": "REF-123"},
        }

        processed_attempt, success = PaymentService.process_esewa_callback(
            transaction_uuid=attempt.transaction_uuid,
            encoded_data="",
        )

        attempt.refresh_from_db()
        booking.refresh_from_db()
        self.assertEqual(processed_attempt.pk, attempt.pk)
        self.assertFalse(success)
        self.assertEqual(attempt.status, AttemptStatus.NEEDS_RECONCILIATION)
        self.assertIn("Manual reconciliation required", attempt.failure_reason)
        self.assertEqual(booking.status, BookingStatus.EXPIRED)
        self.assertTrue(Payment.objects.filter(attempt=attempt).exists())


# ===========================================================================
# PAYMENT INITIATION
# ===========================================================================

@override_settings(ESEWA_PRODUCT_CODE="EPAYTEST", ESEWA_SECRET_KEY="test-secret")
class PaymentInitiationTests(TestCase):
    """Tests for PaymentService.initiate_esewa_payment."""

    account_seq = 0

    def create_traveller(self):
        self.__class__.account_seq += 1
        return Account.objects.create(
            email=f"payer-{self.__class__.account_seq}@example.com",
            role=Account.Role.TRAVELLER,
            first_name="Payer",
            last_name="Test",
            is_active=True,
        )

    def create_booking(self, traveller, *, status=BookingStatus.PENDING_PAYMENT, expired=False):
        from django.utils import timezone
        from datetime import timedelta
        expires_at = (
            timezone.now() - timedelta(hours=1) if expired
            else timezone.now() + timedelta(minutes=15)
        )
        return Booking.objects.create(
            traveller=traveller,
            status=status,
            expires_at=expires_at,
            quoted_total=Decimal("1416.00"),
        )

    def test_valid_booking_creates_attempt_and_returns_form_fields(self):
        traveller = self.create_traveller()
        booking = self.create_booking(traveller)

        attempt, form_data = PaymentService.initiate_esewa_payment(booking, traveller)

        self.assertEqual(attempt.booking, booking)
        self.assertEqual(attempt.status, AttemptStatus.INITIATED)
        self.assertIn("total_amount", form_data)
        self.assertIn("transaction_uuid", form_data)
        self.assertIn("signature", form_data)

    def test_confirmed_booking_raises_service_error(self):
        from utils.exceptions import ServiceError
        traveller = self.create_traveller()
        booking = self.create_booking(traveller, status=BookingStatus.CONFIRMED)

        with self.assertRaises(ServiceError) as exc:
            PaymentService.initiate_esewa_payment(booking, traveller)

        self.assertEqual(exc.exception.status_code, 400)

    def test_expired_booking_raises_service_error(self):
        from utils.exceptions import ServiceError
        traveller = self.create_traveller()
        booking = self.create_booking(traveller, expired=True)

        with self.assertRaises(ServiceError) as exc:
            PaymentService.initiate_esewa_payment(booking, traveller)

        self.assertEqual(exc.exception.status_code, 400)

    def test_second_initiation_on_same_booking_raises_409(self):
        from utils.exceptions import ServiceError
        traveller = self.create_traveller()
        booking = self.create_booking(traveller)

        PaymentService.initiate_esewa_payment(booking, traveller)

        with self.assertRaises(ServiceError) as exc:
            PaymentService.initiate_esewa_payment(booking, traveller)

        self.assertEqual(exc.exception.status_code, 409)
        self.assertEqual(exc.exception.get_codes(), "active_attempt_exists")
