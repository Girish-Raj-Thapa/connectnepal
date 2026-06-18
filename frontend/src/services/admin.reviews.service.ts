/**
 * Admin Reviews Service
 * ---------------------
 * API methods for admin-only review moderation endpoints.
 */

import api from '@services/api.service';
import type { AxiosError } from 'axios';
import { extractApiError } from '@utils/apiError';
import type {
	Review,
	ReviewReport,
	AdminModeratePayload,
	AdminModerateReplyPayload,
	PaginatedResponse,
} from '@/types/reviews';

interface ReportListParams {
	status?: string;
	targetType?: string;
	reason?: string;
	page?: number;
}

export const AdminReviewsService = {
	/**
	 * GET /api/admin/review-reports/
	 * Paginated list of review reports for the moderation queue.
	 * Supports filtering by status, target_type, reason.
	 */
	listReports: async (
		params?: ReportListParams,
	): Promise<PaginatedResponse<ReviewReport>> => {
		try {
			const res = await api.get<PaginatedResponse<ReviewReport>>(
				'/admin/review-reports/',
				{
					params: params
						? {
								...(params.status && { status: params.status }),
								...(params.targetType && { target_type: params.targetType }),
								...(params.reason && { reason: params.reason }),
								...(params.page && { page: params.page }),
							}
						: {},
				},
			);
			return res.data;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 403)
				throw new Error('Admin access required.');
			return extractApiError(error,'Failed to fetch reports');
		}
	},

	/**
	 * POST /api/admin/reviews/{id}/moderate/
	 * Change review status (mark_published, mark_under_review, mark_removed).
	 */
	moderateReview: async (
		id: number,
		payload: AdminModeratePayload,
	): Promise<Review> => {
		try {
			const res = await api.post<Review>(
				`/admin/reviews/${id}/moderate/`,
				payload,
			);
			return res.data;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 403)
				throw new Error('Admin access required.');
			if (axiosError.response?.status === 404)
				throw new Error('Review not found.');
			return extractApiError(error,'Failed to moderate review');
		}
	},

	/**
	 * POST /api/admin/reviews/{id}/reply/moderate/
	 * Keep or remove host reply (remove_reply, keep_reply).
	 */
	moderateReply: async (
		id: number,
		payload: AdminModerateReplyPayload,
	): Promise<Review> => {
		try {
			const res = await api.post<Review>(
				`/admin/reviews/${id}/reply/moderate/`,
				payload,
			);
			return res.data;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 403)
				throw new Error('Admin access required.');
			if (axiosError.response?.status === 404)
				throw new Error('Review not found.');
			return extractApiError(error,'Failed to moderate reply');
		}
	},
};

export default AdminReviewsService;
