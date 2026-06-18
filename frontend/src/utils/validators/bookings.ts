import * as yup from 'yup';
import type { CancellationReason } from '@/types/bookings';


// ─── Checkout form ────────────────────────────────────────────────────────────

/**
 * Dynamic schema factory: generates the correct validation rules
 * for a listing's group size limits.
 * Call once per listing load inside CheckoutForm (not in the shell page).
 *
 * No durationType param needed — date/time fields are gone.
 * The traveller picks a slot_id; all schedule info comes from the slot.
 */
export const buildCheckoutSchema = (
	minGroupSize: number,
	maxGroupSize: number,
) =>
	yup.object({
		travellerCount: yup
			.number()
			.typeError('Traveller count must be a number')
			.required('Number of travellers is required')
			.min(minGroupSize, `Minimum group size is ${minGroupSize}`)
			.max(maxGroupSize, `Maximum group size is ${maxGroupSize}`)
			.integer('Must be a whole number'),
		slotId: yup
			.number()
			.typeError('Please select an available time slot')
			.required('Please select an available time slot')
			.min(1, 'Please select an available time slot')
			.integer(),
	});

export type CheckoutFormData = {
	travellerCount: number;
	slotId:         number;
};


// ─── Cancel booking form ──────────────────────────────────────────────────────

// Travellers can only self-service cancel with these two reasons.
// Other reasons (host_unavailable, admin_action, etc.) are reserved for backend use.
const TRAVELLER_CANCEL_REASONS: CancellationReason[] = ['traveller_request', 'other'];

export const cancelBookingSchema = yup.object({
	reason: yup
		.mixed<CancellationReason>()
		.required('Please select a cancellation reason')
		.oneOf(TRAVELLER_CANCEL_REASONS, 'Invalid cancellation reason'),
	note: yup
		.string()
		.optional()
		.max(1000, 'Note cannot exceed 1000 characters')
		.default(''),
});

export type CancelBookingFormData = yup.InferType<typeof cancelBookingSchema>;


// ─── Book from trip plan form ─────────────────────────────────────────────────

/**
 * Each item carries its own tripPlanItemId and the traveller picks a slotId.
 * No date/time fields — all schedule info comes from the selected slot.
 */
export const fromTripItemSchema = yup.object({
	tripPlanItemId: yup.number().required(),
	travellerCount: yup
		.number()
		.typeError('Travellers must be a number')
		.required('Travellers required')
		.min(1, 'At least 1 traveller required')
		.integer('Must be a whole number'),
	slotId: yup
		.number()
		.typeError('Please select an available time slot')
		.required('Please select an available time slot')
		.min(1, 'Please select an available time slot')
		.integer(),
});

export const fromTripSchema = yup.object({
	items: yup
		.array()
		.of(fromTripItemSchema)
		.required()
		.min(1, 'No items to book'),
});

export type FromTripItemFormData = yup.InferType<typeof fromTripItemSchema>;
export type FromTripFormData = yup.InferType<typeof fromTripSchema>;
