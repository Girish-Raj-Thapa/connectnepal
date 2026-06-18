/**
 * Payment Types
 * -------------
 * Domain types for eSewa payment integration.
 * Matches the API contract in docs/payment_api_guide.md.
 */

export type AttemptStatus = 'initiated' | 'pending' | 'verified' | 'failed' | 'expired';

export type PaymentProvider = 'esewa' | 'stripe';

/**
 * eSewa form fields — always snake_case.
 *
 * IMPORTANT: The API response interceptor (api.service.ts) camelizes all
 * response keys. The payments service re-snakifies these fields before
 * returning them, so consumers always receive the original snake_case names
 * that eSewa requires for its form POST.
 */
export interface EsewaFormFields {
    amount: string;
    tax_amount: string;
    total_amount: string;
    transaction_uuid: string;
    product_code: string;
    product_service_charge: string;
    product_delivery_charge: string;
    success_url: string;
    failure_url: string;
    signed_field_names: string;
    signature: string;
}

/**
 * Response from POST /api/payments/esewa/initiate/
 *
 * Top-level keys are camelized by the interceptor (attemptId, formUrl).
 * The `fields` object has been re-snakified by the service layer.
 */
export interface EsewaInitiateResponse {
    attemptId: number;
    formUrl: string;
    fields: EsewaFormFields;
}

/**
 * Response from GET /api/payments/attempts/<id>/status/
 */
export interface PaymentAttemptStatus {
    id: number;
    status: AttemptStatus;
    bookingId: number;
    provider: PaymentProvider;
    createdAt: string;
    verifiedAt: string | null;
}

/**
 * Allowlisted failure reason codes from the backend callback redirect.
 * Source: docs/payment_api_guide.md §2.2
 */
export type FailureReason =
    | 'canceled'
    | 'not_found'
    | 'payment_not_completed'
    | 'refunded'
    | 'signature_mismatch'
    | 'verification_failed'
    | 'verification_pending'
    | 'expired'
    | 'unknown';
