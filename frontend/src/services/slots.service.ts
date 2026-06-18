/**
 * Slots Service
 * -------------
 * API methods for managing activity slots, schedules, and date exceptions
 * on host listings.
 */

import api from '@services/api.service';
import { extractApiError } from '@utils/apiError';
import type {
	ActivitySlot,
	CreateSlotPayload,
	UpdateSlotPayload,
	DeleteSlotResult,
	ListingSchedule,
	CreateSchedulePayload,
	UpdateSchedulePayload,
	SlotException,
	CreateExceptionPayload,
	UpdateExceptionPayload,
	GenerateSlotsResult,
} from '@/types/bookings';

const slotsService = {
	// ── Slot management ───────────────────────────────────────────────────────

	/**
	 * List all slots (active + inactive) for a listing owned by the host.
	 * GET /api/listings/host/<id>/slots/
	 */
	getHostSlots: async (listingId: number): Promise<ActivitySlot[]> => {
		try {
			const res = await api.get<ActivitySlot[]>(`/listings/host/${listingId}/slots/`);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to fetch slots');
		}
	},

	/**
	 * Create a new slot for a listing.
	 * POST /api/listings/host/<id>/slots/
	 */
	createSlot: async (listingId: number, data: CreateSlotPayload): Promise<ActivitySlot> => {
		try {
			const res = await api.post<ActivitySlot>(`/listings/host/${listingId}/slots/`, data);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to create slot');
		}
	},

	/**
	 * Update a slot's capacity and/or active status.
	 * PATCH /api/listings/host/<id>/slots/<slot_id>/
	 */
	updateSlot: async (
		listingId: number,
		slotId:    number,
		data:      UpdateSlotPayload,
	): Promise<ActivitySlot> => {
		try {
			const res = await api.patch<ActivitySlot>(
				`/listings/host/${listingId}/slots/${slotId}/`,
				data,
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to update slot');
		}
	},

	/**
	 * Delete a slot.
	 * - 204 → hard deleted. Returns { deactivated: false }.
	 * - 200 → deactivated (active bookings exist). Returns { deactivated: true, slot }.
	 * DELETE /api/listings/host/<id>/slots/<slot_id>/
	 */
	deleteSlot: async (listingId: number, slotId: number): Promise<DeleteSlotResult> => {
		try {
			const res = await api.delete<{ detail: string; slot: ActivitySlot } | undefined>(
				`/listings/host/${listingId}/slots/${slotId}/`,
			);
			if (res.status === 204 || !res.data) return { deactivated: false };
			return { deactivated: true, slot: res.data.slot };
		} catch (error: unknown) {
			return extractApiError(error,'Failed to delete slot');
		}
	},


	// ── Schedule management ───────────────────────────────────────────────────

	/**
	 * List all schedules for a listing.
	 * GET /api/listings/host/<id>/schedules/
	 */
	getSchedules: async (listingId: number): Promise<ListingSchedule[]> => {
		try {
			const res = await api.get<ListingSchedule[]>(`/listings/host/${listingId}/schedules/`);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to fetch schedules');
		}
	},

	/**
	 * Create a new schedule.
	 * POST /api/listings/host/<id>/schedules/
	 */
	createSchedule: async (listingId: number, data: CreateSchedulePayload): Promise<ListingSchedule> => {
		try {
			const res = await api.post<ListingSchedule>(`/listings/host/${listingId}/schedules/`, data);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to create schedule');
		}
	},

	/**
	 * Update a schedule.
	 * PATCH /api/listings/host/<id>/schedules/<schedule_id>/
	 */
	updateSchedule: async (
		listingId:  number,
		scheduleId: number,
		data:       UpdateSchedulePayload,
	): Promise<ListingSchedule> => {
		try {
			const res = await api.patch<ListingSchedule>(
				`/listings/host/${listingId}/schedules/${scheduleId}/`,
				data,
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to update schedule');
		}
	},

	/**
	 * Delete a schedule.
	 * DELETE /api/listings/host/<id>/schedules/<schedule_id>/
	 */
	deleteSchedule: async (listingId: number, scheduleId: number): Promise<void> => {
		try {
			await api.delete(`/listings/host/${listingId}/schedules/${scheduleId}/`);
		} catch (error: unknown) {
			return extractApiError(error,'Failed to delete schedule');
		}
	},

	/**
	 * Trigger slot generation for a listing.
	 * POST /api/listings/host/<id>/generate-slots/
	 */
	generateSlots: async (listingId: number): Promise<GenerateSlotsResult> => {
		try {
			const res = await api.post<GenerateSlotsResult>(`/listings/host/${listingId}/generate-slots/`);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to generate slots');
		}
	},


	// ── Exception management ──────────────────────────────────────────────────

	/**
	 * List all date exceptions for a listing.
	 * GET /api/listings/host/<id>/exceptions/
	 */
	getExceptions: async (listingId: number): Promise<SlotException[]> => {
		try {
			const res = await api.get<SlotException[]>(`/listings/host/${listingId}/exceptions/`);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to fetch exceptions');
		}
	},

	/**
	 * Create a date exception.
	 * POST /api/listings/host/<id>/exceptions/
	 */
	createException: async (listingId: number, data: CreateExceptionPayload): Promise<SlotException> => {
		try {
			const res = await api.post<SlotException>(`/listings/host/${listingId}/exceptions/`, data);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to create exception');
		}
	},

	/**
	 * Update a date exception.
	 * PATCH /api/listings/host/<id>/exceptions/<exception_id>/
	 */
	updateException: async (
		listingId:   number,
		exceptionId: number,
		data:        UpdateExceptionPayload,
	): Promise<SlotException> => {
		try {
			const res = await api.patch<SlotException>(
				`/listings/host/${listingId}/exceptions/${exceptionId}/`,
				data,
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to update exception');
		}
	},

	/**
	 * Delete a date exception.
	 * DELETE /api/listings/host/<id>/exceptions/<exception_id>/
	 */
	deleteException: async (listingId: number, exceptionId: number): Promise<void> => {
		try {
			await api.delete(`/listings/host/${listingId}/exceptions/${exceptionId}/`);
		} catch (error: unknown) {
			return extractApiError(error,'Failed to delete exception');
		}
	},
};

export default slotsService;
