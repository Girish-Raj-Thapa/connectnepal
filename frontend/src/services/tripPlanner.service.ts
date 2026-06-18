/**
 * Trip Planner Service
 * --------------------
 * API methods for traveller trip plan management.
 * Uses the shared Axios client.
 */

import api from '@services/api.service';
import { extractApiError } from '@utils/apiError';
import type { PaginatedResponse } from '@/types/listings';
import type {
	TripPlanListItem,
	TripPlanDetail,
	TripPlanListParams,
	CreateTripPlanRequest,
	UpdateTripPlanRequest,
	TripPlannerItem,
	AddTripItemRequest,
	UpdateTripItemRequest,
	ReorderEntry,
} from '@/types/tripPlanner';


const tripPlannerService = {
	// ─── Trip Planner ─────────────────────────

	/**
	 * List traveller's trip plans (paginated, filterable by status).
	 *
	 * GET /api/trip-planner/
	 */
	listMyTripPlans: async (
		params: TripPlanListParams = {},
	): Promise<PaginatedResponse<TripPlanListItem>> => {
		try {
			const res = await api.get<PaginatedResponse<TripPlanListItem>>(
				'/trip-planner/',
				{
					params: {
						...(params.status ? { status: params.status } : {}),
						...(params.page ? { page: params.page } : {}),
					},
				},
			);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to fetch trip plans');
		}
	},

	/**
	 * Get full plan detail with items grouped by day.
	 *
	 * GET /api/trip-planner/<id>/
	 */
	getTripPlan: async (id: number): Promise<TripPlanDetail> => {
		try {
			const res = await api.get<TripPlanDetail>(`/trip-planner/${id}/`);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to fetch trip plan');
		}
	},

	/**
	 * Create a new trip plan.
	 *
	 * POST /api/trip-planner/
	 */
	createTripPlan: async (
		data: CreateTripPlanRequest,
	): Promise<TripPlanDetail> => {
		try {
			const res = await api.post<TripPlanDetail>('/trip-planner/', data);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to create trip plan');
		}
	},

	/**
	 * Update plan metadata.
	 *
	 * PATCH /api/trip-planner/<id>/
	 */
	updateTripPlan: async (
		id: number,
		data: UpdateTripPlanRequest,
	): Promise<TripPlanDetail> => {
		try {
			const res = await api.patch<TripPlanDetail>(
				`/trip-planner/${id}/`,
				data,
			);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to update trip plan');
		}
	},

	/**
	 * Archive (soft-delete) a trip plan.
	 *
	 * DELETE /api/trip-planner/<id>/
	 */
	deleteTripPlan: async (id: number): Promise<void> => {
		try {
			await api.delete(`/trip-planner/${id}/`);
		} catch (error) {
			return extractApiError(error, 'Failed to archive trip plan');
		}
	},

	// ─── Trip Planner Item Level ──────
	/**
	 * Add a listing to a specific day within the plan.
	 *
	 * POST /api/trip-planner/<planId>/items/
	 */
	addTripItem: async (
		planId: number,
		data: AddTripItemRequest,
	): Promise<TripPlannerItem> => {
		try {
			const res = await api.post<TripPlannerItem>(
				`/trip-planner/${planId}/items/`,
				data,
			);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to add experience');
		}
	},

	/**
	 * Update an item's day, order, or notes.
	 *
	 * PATCH /api/trip-planner/<planId>/items/<itemId>/
	 */
	updateTripItem: async (
		planId: number,
		itemId: number,
		data: UpdateTripItemRequest,
	): Promise<TripPlannerItem> => {
		try {
			const res = await api.patch<TripPlannerItem>(
				`/trip-planner/${planId}/items/${itemId}/`,
				data,
			);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to update item');
		}
	},

	/**
	 * Remove an item from the plan.
	 *
	 * DELETE /api/trip-planner/<planId>/items/<itemId>/
	 */
	deleteTripItem: async (
		planId: number,
		itemId: number,
	): Promise<void> => {
		try {
			await api.delete(`/trip-planner/${planId}/items/${itemId}/`);
		} catch (error) {
			return extractApiError(error, 'Failed to remove item');
		}
	},

	/**
	 * Bulk reorder items across days.
	 *
	 * PATCH /api/trip-planner/<planId>/items/reorder/
	 */
	reorderTripItems: async (
		planId: number,
		entries: ReorderEntry[],
	): Promise<void> => {
		try {
			await api.patch(`/trip-planner/${planId}/items/reorder/`, entries);
		} catch (error) {
			return extractApiError(error, 'Failed to reorder items');
		}
	},
};

export default tripPlannerService;
