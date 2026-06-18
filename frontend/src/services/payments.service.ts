/**
 * Payments Service
 * ----------------
 * Handles eSewa payment initiation and status polling.
 * Reference: docs/payment_api_guide.md
 *
 * SNAKE_CASE CONTRACT
 * The global response interceptor (api.service.ts) camelizes all response keys.
 * eSewa's form POST requires the original snake_case field names, so we
 * re-snakify `fields` after receiving the camelized API response.
 */

import api from '@services/api.service';
import { snakifyKeys } from '@utils/case';
import type { AxiosError } from 'axios';
import type {
    EsewaFormFields,
    EsewaInitiateResponse,
    PaymentAttemptStatus,
} from '@/types/payments';


/** Extract a human-readable error message — same pattern as bookings.service.ts */
const extractError = (error: unknown, fallback: string): never => {
    const axiosError = error as AxiosError<{
        detail?: string;
        message?: string;
        code?: string;
    }>;

    if (axiosError.response) {
        const code   = axiosError.response.data?.code;
        const detail = axiosError.response.data?.detail;

        // Map known backend error codes to user-friendly messages
        if (code === 'invalid_booking_state') {
            throw new Error('This booking cannot be paid in its current state.');
        }
        if (code === 'booking_expired') {
            throw new Error('Your booking has expired. Please create a new booking.');
        }
        if (code === 'active_attempt_exists') {
            throw new Error(
                'A payment is already in progress for this booking. ' +
                'Complete it in your other tab, or wait a few minutes and try again.',
            );
        }

        throw new Error(detail ?? axiosError.response.data?.message ?? fallback);
    }

    if (axiosError.request) {
        throw new Error('Network error. Please check your connection and try again.');
    }

    throw new Error('An unexpected error occurred.');
};

// Required eSewa field names after re-snakification
const REQUIRED_ESEWA_FIELDS: (keyof EsewaFormFields)[] = [
    'amount',
    'tax_amount',
    'total_amount',
    'transaction_uuid',
    'product_code',
    'product_service_charge',
    'product_delivery_charge',
    'success_url',
    'failure_url',
    'signed_field_names',
    'signature',
];

interface EsewaInitiateApiResponse {
    attemptId: number;
    formUrl: string;
    fields: Record<string, string>;
}

const isEsewaFormFields = (fields: unknown): fields is EsewaFormFields => {
    if (!fields || typeof fields !== 'object') return false;
    const maybeFields = fields as Partial<Record<keyof EsewaFormFields, unknown>>;
    return REQUIRED_ESEWA_FIELDS.every(
        (key) => typeof maybeFields[key] === 'string' && maybeFields[key].length > 0,
    );
};


export const PaymentService = {

    /**
     * Initiate an eSewa payment for a booking.
     *
     * POST /api/payments/esewa/initiate/
     *
     * Sends { booking_id } (request interceptor snakifies bookingId → booking_id).
     * Re-snakifies the camelized `fields` from the response so they match
     * eSewa's form field requirements exactly.
     *
     * Returns 201 on success.
     * Throws on 400 (expired/invalid state), 404 (not found), 409 (active attempt).
     */
    initiateEsewaPayment: async (bookingId: number): Promise<EsewaInitiateResponse> => {
        try {
            // request interceptor auto-snakifies { bookingId } → { booking_id }
            const res = await api.post<EsewaInitiateApiResponse>(
                '/payments/esewa/initiate/',
                { bookingId },
            );

            // response interceptor camelizes fields keys — restore snake_case for eSewa
            const rawFields = snakifyKeys(res.data.fields);

            // runtime guard: fail fast if backend response shape changes
            if (!isEsewaFormFields(rawFields)) {
                throw new Error('eSewa payment form is incomplete. Please try again.');
            }

            return {
                attemptId: res.data.attemptId,
                formUrl:   res.data.formUrl,
                fields:    rawFields,
            };
        } catch (error) {
            return extractError(error, 'Failed to initiate payment. Please try again.');
        }
    },

    /**
     * Poll the status of a payment attempt.
     *
     * GET /api/payments/attempts/<attemptId>/status/
     *
     * Poll every 3 seconds until status is "verified", "failed", or "expired".
     */
    getAttemptStatus: async (attemptId: number): Promise<PaymentAttemptStatus> => {
        try {
            const res = await api.get<PaymentAttemptStatus>(
                `/payments/attempts/${attemptId}/status/`,
            );
            return res.data;
        } catch (error) {
            return extractError(error, 'Failed to fetch payment status.');
        }
    },
};
