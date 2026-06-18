import base64
import hashlib
import hmac
import json
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class EsewaServiceError(Exception):
    """
    Raised when an eSewa API call fails due to network issues,
    non-JSON response (service unavailable), or timeout.

    This is distinct from ServiceError (which is DRF-level).
    payment_service.py catches this and handles it as a PENDING/retry case.
    """
    pass


class EsewaService:
    """
    eSewa v2 payment gateway integration.

    Handles:
    - HMAC-SHA256 signature generation and verification
    - Building eSewa v2 form POST fields
    - Decoding Base64 callback ?data= param
    - Server-to-server Status Check API call

    All methods are @staticmethod because there is no instance state —
    all config comes from settings.
    """
    
    @staticmethod
    def generate_signature(message: str) -> str:
        """
        Generate HMAC-SHA256 Base64 signature for eSewa v2.

        The message MUST be in the exact format:
            total_amount=<value>,transaction_uuid=<value>,product_code=<value>

        Signed with settings.ESEWA_SECRET_KEY (UTF-8 encoded).

        Args:
            message: Comma-separated key=value string of signed fields.

        Returns:
            Base64-encoded HMAC-SHA256 digest string.
        """
        key = settings.ESEWA_SECRET_KEY.encode("utf-8")
        msg = message.encode("utf-8")
        digest = hmac.new(key, msg, hashlib.sha256).digest()
        return base64.b64encode(digest).decode("utf-8")
    

    @staticmethod
    def verify_signature(message: str, provided_signature: str) -> bool:
        """
        Verify a signature from eSewa callback data.

        Regenerates the expected signature from the message and compares
        using hmac.compare_digest() for timing-safe comparison (prevents
        timing attacks that could reveal the secret key).

        Args:
            message: Comma-separated key=value string (from signed_field_names).
            provided_signature: Base64 signature from eSewa response.

        Returns:
            True if signature is valid, False otherwise.
        """
        try:
            expected = EsewaService.generate_signature(message)
            return hmac.compare_digest(expected, provided_signature)
        except Exception as e:
            logger.warning("Signature verification error: %s", e)
            return False
    

    @staticmethod
    def build_form_fields(attempt) -> dict:
        """
        Build the complete set of eSewa v2 form POST fields for a PaymentAttempt.

        Returns a dict with ALL required eSewa v2 fields. The frontend must submit ALL of these as hidden inputs in a form POST to ESEWA_PAYMENT_URL.

        Critical: amount_str is reused from the attempt to ensure the value used for signing is identical to the value in the form field and the value later used in the Status Check query param.

        Args:
            attempt: PaymentAttempt instance (must have transaction_uuid and amount_str set).

        Returns:
            dict of all eSewa v2 form fields including signature.
        """
        # Build the EXACT signature message format required by eSewa v2.
        # Field order is non-negotiable: total_amount, transaction_uuid, product_code.
        message = (
            f"total_amount={attempt.amount_str},"
            f"transaction_uuid={attempt.transaction_uuid},"
            f"product_code={settings.ESEWA_PRODUCT_CODE}"
        )
        signature = EsewaService.generate_signature(message)


        # Callback URL uses transaction_uuid so eSewa's redirect includes
        # the identifier needed to look up the PaymentAttempt without auth.
        callback_base_url = (
            f"{settings.BACKEND_BASE_URL}/api/payments/esewa/callback/"
            f"{attempt.transaction_uuid}/"
        )

        return {
            # Base amount (before eSewa's own platform tax — which we set to 0)
            "amount": attempt.amount_str,

            # eSewa platform tax on top of amount — not our application tax.
            # Our quoted_total already includes VAT. We do NOT add more eSewa tax.
            "tax_amount": "0",

            # total_amount = amount + tax_amount = amount + 0 = amount.
            # Must be the IDENTICAL string used in the signature.
            "total_amount": attempt.amount_str,

            "transaction_uuid": attempt.transaction_uuid,

            "product_code": settings.ESEWA_PRODUCT_CODE,

            # Required by eSewa v2 even if zero. Omitting them breaks the form.
            "product_service_charge": "0",
            "product_delivery_charge": "0",

            # Both success and failure redirect to the same backend callback.
            # The backend distinguishes using the Status Check API, not eSewa's
            # success vs failure URL logic.
            "success_url": f"{callback_base_url}?source=success",
            "failure_url": f"{callback_base_url}?source=failure",

            # Exact field order for signature verification.
            "signed_field_names": "total_amount,transaction_uuid,product_code",

            "signature": signature,
        }
    

    @staticmethod
    def decode_callback_data(data_param: str) -> dict:
        """
        Decode the Base64-encoded ?data= param from eSewa's callback redirect.

        The decoded JSON contains:
            transaction_code, status, total_amount, transaction_uuid,
            product_code, signed_field_names, signature

        IMPORTANT: This data is used for correlation/logging ONLY.
        It is NOT trusted for payment finalization. Only the Status Check
        API (server-to-server) is the source of truth.

        Args:
            data_param: Raw ?data= query parameter string from eSewa redirect.

        Returns:
            Parsed dict, or empty dict if decoding fails.
        """
        if not data_param:
            return {}
        try:
            # eSewa's Base64 may not be padded — add padding if needed.
            padded = data_param + "=" * (4 - len(data_param) % 4)
            decoded_bytes = base64.b64decode(padded)
            return json.loads(decoded_bytes.decode("utf-8"))
        except Exception as e:
            logger.warning("Failed to decode eSewa callback data param: %s", e)
            return {}
    

    @staticmethod
    def verify_transaction_status(
        product_code: str,
        total_amount: str,
        transaction_uuid: str,
    ) -> dict:
        """
        Call eSewa Status Check API server-to-server.

        This is the AUTHORITATIVE source of truth for payment finalization.
        Never finalize a payment based on callback redirect data alone.

        Uses GET with query params:
            https://uat.esewa.com.np/api/epay/transaction/status/
                ?product_code=EPAYTEST
                &total_amount=<amount_str>   ← MUST be the identical string used for signing
                &transaction_uuid=<uuid>

        Handles ALL documented eSewa statuses:
            COMPLETE        → payment succeeded, finalize
            PENDING         → inconclusive, do NOT finalize, retry later
            AMBIGUOUS       → same as PENDING (normalizes AMBIGIOUS typo)
            FULL_REFUND     → mark failed
            PARTIAL_REFUND  → mark failed
            CANCELED        → mark failed
            NOT_FOUND       → mark failed

        Also handles non-JSON "service unavailable" responses from eSewa.

        Args:
            product_code: eSewa product code (EPAYTEST for UAT).
            total_amount: EXACT same string used for signing (attempt.amount_str).
            transaction_uuid: The UUID sent to eSewa (attempt.transaction_uuid).

        Returns:
            Normalized dict:
            {
                'status': str,          # Normalized status (AMBIGIOUS → AMBIGUOUS)
                'ref_id': str,          # eSewa's ref_id (unique per transaction)
                'transaction_code': str, # eSewa's transaction_code
                'total_amount': str,     # Amount from eSewa response
                'raw': dict,             # Full raw response for audit storage
            }

        Raises:
            EsewaServiceError: On network errors, timeouts, or non-JSON responses.
        """
        params = {
            "product_code": product_code,
            "total_amount": total_amount,
            "transaction_uuid": transaction_uuid,
        }

        logger.info(
            "Calling eSewa Status Check API for transaction_uuid=%s total_amount=%s",
            transaction_uuid, total_amount,
        )

        try:
            response = requests.get(
                settings.ESEWA_STATUS_CHECK_URL,
                params=params,
                timeout=10,
            )
        except requests.exceptions.Timeout:
            logger.error(
                "eSewa Status Check timed out for transaction_uuid=%s",
                transaction_uuid,
            )
            raise EsewaServiceError(
                f"eSewa Status Check timed out for {transaction_uuid}"
            )
        except requests.exceptions.RequestException as e:
            logger.error(
                "eSewa Status Check network error for transaction_uuid=%s: %s",
                transaction_uuid, e,
            )
            raise EsewaServiceError(f"Network error reaching eSewa: {e}")

        # Detect HTML/non-JSON "service unavailable" responses.
        content_type = response.headers.get("Content-Type", "")
        if "application/json" not in content_type and "json" not in content_type:
            logger.error(
                "eSewa Status Check returned non-JSON (service may be down). "
                "status_code=%s content_type=%s body_preview=%s",
                response.status_code,
                content_type,
                response.text[:300],
            )
            raise EsewaServiceError("eSewa returned non-JSON response — service may be unavailable")

        try:
            data = response.json()
        except ValueError:
            logger.error(
                "eSewa Status Check returned unparseable JSON for transaction_uuid=%s: %s",
                transaction_uuid, response.text[:300],
            )
            raise EsewaServiceError("eSewa returned invalid JSON")

        raw_status = data.get("status", "NOT_FOUND")

        # Normalize eSewa documentation typo: AMBIGIOUS → AMBIGUOUS
        if raw_status == "AMBIGIOUS":
            logger.warning(
                "eSewa returned typo status 'AMBIGIOUS' for transaction_uuid=%s. "
                "Normalizing to 'AMBIGUOUS'.",
                transaction_uuid,
            )
            raw_status = "AMBIGUOUS"

        logger.info(
            "eSewa Status Check response: transaction_uuid=%s status=%s ref_id=%s",
            transaction_uuid,
            raw_status,
            data.get("ref_id", "N/A"),
        )
        return {
            "status": raw_status,
            "ref_id": data.get("ref_id", ""),
            "transaction_code": data.get("transaction_code", ""),
            "total_amount": data.get("total_amount", total_amount),
            "raw": data,
        }
    
