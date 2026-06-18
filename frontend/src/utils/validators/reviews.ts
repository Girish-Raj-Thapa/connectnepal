/**
 * Review Validators
 */

import * as yup from 'yup';

/**
 * Host reply form
 * Required: non-empty, max 2000 chars
 */
export const hostReplySchema = yup.object({
	reply: yup
		.string()
		.required('Reply is required')
		.trim()
		.min(1, 'Reply cannot be empty')
		.max(2000, 'Reply must be under 2000 characters'),
});

export type HostReplyFormData = yup.InferType<typeof hostReplySchema>;

/**
 * Traveller review creation/edit form
 * Required: rating 1–5
 * Low-rating rule: If rating is 1 or 2, comment is required with ≥20 chars
 */
export const createReviewSchema = yup.object({
	rating: yup
		.number()
		.required('Rating is required')
		.min(1, 'Rating must be between 1 and 5')
		.max(5, 'Rating must be between 1 and 5'),
	comment: yup
		.string()
		.optional()
		.max(5000, 'Comment must be under 5000 characters')
		.when('rating', {
			is: (val: number) => val === 1 || val === 2,
			then: (schema) =>
				schema
					.required('A comment is required for ratings of 1 or 2 stars')
					.min(20, 'Comment must be at least 20 characters for low ratings'),
		}),
});

export type CreateReviewFormData = yup.InferType<typeof createReviewSchema>;

/**
 * Edit review — reuses create schema (same low-rating rule applies)
 */
export const editReviewSchema = createReviewSchema;
export type EditReviewFormData = CreateReviewFormData;

/**
 * Report review/reply form
 * Required: reason (one of 8 choices)
 * Optional: details (max 500 chars)
 */
export const reportReviewSchema = yup.object({
	reason: yup
		.string()
		.oneOf(
			[
				'abusive_language',
				'hate_speech',
				'threats',
				'spam',
				'irrelevant_content',
				'fraudulent_claim',
				'privacy_violation',
				'other',
			],
			'Please select a valid reason',
		)
		.required('Please select a reason'),
	details: yup.string().max(500, 'Details must be under 500 characters').optional(),
});

export type ReportReviewFormData = yup.InferType<typeof reportReviewSchema>;
