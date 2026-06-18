/**
 * Reviews Service
 */

import api from '@services/api.service';
import type { AxiosError } from 'axios';
import { extractApiError } from '@utils/apiError';
import type {
	Review,
	HostInboxReview,
	CreateReviewPayload,
	UpdateReviewPayload,
	HostReplyPayload,
	ReportReviewPayload,
	ReportSubmissionResponse,
	PaginatedResponse,
} from '@/types/reviews';

const reviewsService = {
	/**
	 * GET /api/reviews/
	 * Fetch authenticated traveller's own reviews (paginated, 20/page)
	 */
	listMyReviews: async (page?: number): Promise<PaginatedResponse<Review>> => {
		try {
			const res = await api.get<PaginatedResponse<Review>>('/reviews/', {
				params: page ? { page } : {},
			});
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to fetch reviews');
		}
	},

	/**
	 * POST /api/reviews/
	 * Traveller submits a review for a listing or package
	 * Requires completed booking item; rating 1–5
	 */
	createReview: async (payload: CreateReviewPayload): Promise<Review> => {
		try {
			const res = await api.post<Review>('/reviews/', payload);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to create review');
		}
	},

	/**
	 * GET /api/reviews/{id}/
	 * Fetch a single traveller-owned review.
	 */
	getReviewById: async (id: number): Promise<Review> => {
		try {
			const res = await api.get<Review>(`/reviews/${id}/`);
			return res.data;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 403)
				throw new Error('You can only view your own reviews.');
			if (axiosError.response?.status === 404)
				throw new Error('Review not found.');
			return extractApiError(error,'Failed to fetch review');
		}
	},

	/**
	 * DELETE /api/reviews/{id}/
	 * Traveller deletes their own review
	 * 403 if not review owner; 404 if not found
	 */
	deleteReview: async (id: number): Promise<void> => {
		try {
			await api.delete(`/reviews/${id}/`);
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 403)
				throw new Error('You can only delete your own reviews.');
			if (axiosError.response?.status === 404)
				throw new Error('Review not found.');
			return extractApiError(error,'Failed to delete review');
		}
	},

	/**
	 * GET /api/listings/{listing_pk}/reviews/
	 * Public reviews for a listing (paginated, newest first)
	 * No auth required
	 */
	listListingReviews: async (
		listingId: number,
		page?: number,
		pageSize?: number,
	): Promise<PaginatedResponse<Review>> => {
		try {
			const res = await api.get<PaginatedResponse<Review>>(
				`/listings/${listingId}/reviews/`,
				{
					params: {
						...(page ? { page } : {}),
						...(pageSize ? { page_size: pageSize } : {}),
					},
				},
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to fetch listing reviews');
		}
	},

	/**
	 * GET /api/packages/{package_pk}/reviews/
	 * Public reviews for a package (paginated, newest first)
	 * No auth required
	 */
	listPackageReviews: async (
		packageId: number,
		page?: number,
		pageSize?: number,
	): Promise<PaginatedResponse<Review>> => {
		try {
			const res = await api.get<PaginatedResponse<Review>>(
				`/packages/${packageId}/reviews/`,
				{
					params: {
						...(page ? { page } : {}),
						...(pageSize ? { page_size: pageSize } : {}),
					},
				},
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to fetch package reviews');
		}
	},

	/**
	 * GET /api/host/reviews/
	 * Host fetches their review inbox (all reviews on their listings + packages)
	 * Paginated 20/page; auto-filtered to host's items
	 */
	listHostReviews: async (
		page?: number,
	): Promise<PaginatedResponse<HostInboxReview>> => {
		try {
			const res = await api.get<PaginatedResponse<HostInboxReview>>(
				'/host/reviews/',
				{
					params: page ? { page } : {},
				},
			);
			return res.data;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 403)
				throw new Error('Only hosts can access the review inbox.');
			return extractApiError(error,'Failed to fetch host reviews');
		}
	},

	/**
	 * POST /api/host/reviews/{id}/reply/
	 * Host posts or overwrites a reply to a review
	 * 403 if host doesn't own the listing/package
	 */
	postHostReply: async (
		reviewId: number,
		payload: HostReplyPayload,
	): Promise<HostInboxReview> => {
		try {
			const res = await api.post<HostInboxReview>(
				`/host/reviews/${reviewId}/reply/`,
				payload,
			);
			return res.data;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 403)
				throw new Error('You do not own the listing or package for this review.');
			if (axiosError.response?.status === 404)
				throw new Error('Review not found.');
			return extractApiError(error,'Failed to post reply');
		}
	},

	/**
	 * PATCH /api/reviews/{id}/
	 * Traveller edits their own review (within 30-day edit window)
	 * 400 if edit window closed or status not editable
	 * 403 if not review owner
	 */
	editReview: async (id: number, payload: UpdateReviewPayload): Promise<Review> => {
		try {
			const res = await api.patch<Review>(`/reviews/${id}/`, payload);
			return res.data;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 403)
				throw new Error('You can only edit your own reviews.');
			if (axiosError.response?.status === 404)
				throw new Error('Review not found.');
			return extractApiError(error,'Failed to edit review');
		}
	},

	/**
	 * POST /api/host/reviews/{id}/report/
	 * Host reports a review on their listing/package
	 * 400 if duplicate report or review not reportable
	 */
	reportReview: async (
		reviewId: number,
		payload: ReportReviewPayload,
	): Promise<ReportSubmissionResponse> => {
		try {
			const res = await api.post<ReportSubmissionResponse>(
				`/host/reviews/${reviewId}/report/`,
				payload,
			);
			return res.data;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 403)
				throw new Error('You can only report reviews on your own listings.');
			if (axiosError.response?.status === 404)
				throw new Error('Review not found.');
			return extractApiError(error,'Failed to submit report');
		}
	},

	/**
	 * POST /api/host/reviews/{id}/reply/report/
	 * Traveller reports abusive host reply on their own review
	 * 400 if no published reply or duplicate report
	 */
	reportHostReply: async (
		reviewId: number,
		payload: ReportReviewPayload,
	): Promise<ReportSubmissionResponse> => {
		try {
			const res = await api.post<ReportSubmissionResponse>(
				`/host/reviews/${reviewId}/reply/report/`,
				payload,
			);
			return res.data;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 403)
				throw new Error('You can only report replies on your own reviews.');
			if (axiosError.response?.status === 404)
				throw new Error('Review not found.');
			return extractApiError(error,'Failed to submit report');
		}
	},
};

export default reviewsService;
