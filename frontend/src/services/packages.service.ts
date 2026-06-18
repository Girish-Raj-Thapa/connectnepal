/**
 * Packages Service
 * ----------------
 * API methods for host package management.
 * Uses the shared Axios client (auto snake_case ⇄ camelCase via interceptors).
 */

import api from '@services/api.service';
import type { AxiosError } from 'axios';
import type { PaginatedResponse } from '@/types/listings';
import type {
	PackageSummary,
	PackageDetail,
	CreatePackagePayload,
	UpdatePackagePayload,
	ListPackagesParams,
	PackageSlot,
	PackageSchedule,
	PackageSlotException,
	CreatePackageSlotPayload,
	UpdatePackageSlotPayload,
	CreatePackageSchedulePayload,
	UpdatePackageSchedulePayload,
	CreatePackageExceptionPayload,
	UpdatePackageExceptionPayload,
	GenerateSlotsResult,
	ListPackageSlotsParams,
} from '@/types/packages';


function handleApiError(error: unknown, fallback: string): never {
	const axiosError = error as AxiosError<{ detail?: string; message?: string }>;
	if (axiosError.response) {
		throw new Error(
			axiosError.response.data?.detail ||
			axiosError.response.data?.message ||
			fallback,
		);
	}
	if (axiosError.request) {
		throw new Error('Network error. Please check your connection.');
	}
	throw new Error('An unexpected error occurred');
}


const packagesService = {
	/**
	 * List the host's own packages, optionally filtered by publish state.
	 *
	 * GET /api/host/packages/
	 */
	listPackages: async (
		params: ListPackagesParams = {},
	): Promise<PaginatedResponse<PackageSummary>> => {
		try {
			const res = await api.get<PaginatedResponse<PackageSummary>>(
				'/host/packages/',
				{
					params: {
						// Query params are NOT transformed by the interceptor — keep snake_case
						...(params.isBookable !== undefined ? { is_bookable: params.isBookable } : {}),
						...(params.page ? { page: params.page } : {}),
					},
				},
			);
			return res.data;
		} catch (error) {
			handleApiError(error, 'Failed to fetch packages');
		}
	},


	/**
	 * Fetch a single package by ID (for edit form pre-fill).
	 *
	 * GET /api/host/packages/{id}/
	 */
	getPackageById: async (id: number): Promise<PackageDetail> => {
		try {
			const res = await api.get<PackageDetail>(`/host/packages/${id}/`);
			return res.data;
		} catch (error) {
			handleApiError(error, 'Failed to fetch package');
		}
	},


	/**
	 * Create a new package.
	 * Pass listingIds in payload to attach listings atomically.
	 *
	 * POST /api/host/packages/
	 */
	createPackage: async (payload: CreatePackagePayload): Promise<PackageDetail> => {
		try {
			const res = await api.post<PackageDetail>('/host/packages/', payload);
			return res.data;
		} catch (error) {
			handleApiError(error, 'Failed to create package');
		}
	},


	/**
	 * Partially update scalar fields.
	 * Also used for publish/unpublish: pass { isBookable: true | false }.
	 *
	 * PATCH /api/host/packages/{id}/
	 */
	updatePackage: async (
		id: number,
		payload: UpdatePackagePayload,
	): Promise<PackageDetail> => {
		try {
			const res = await api.patch<PackageDetail>(`/host/packages/${id}/`, payload);
			return res.data;
		} catch (error) {
			handleApiError(error, 'Failed to update package');
		}
	},


	/**
	 * Soft-delete a package (sets is_active=false, is_bookable=false).
	 * Blocked if active bookings exist — backend returns 400 active_bookings_exist.
	 *
	 * DELETE /api/host/packages/{id}/
	 */
	deletePackage: async (id: number): Promise<void> => {
		try {
			await api.delete(`/host/packages/${id}/`);
		} catch (error) {
			handleApiError(error, 'Failed to delete package');
		}
	},


	/**
	 * Bulk-replace the full ordered listing set for a package.
	 * Array index determines sort_order (0, 1, 2 …).
	 * listingIds is auto-converted to listing_ids by the request interceptor.
	 *
	 * PUT /api/host/packages/{id}/listings/
	 */
	setPackageListings: async (
		id: number,
		listingIds: number[],
	): Promise<PackageDetail> => {
		try {
			const res = await api.put<PackageDetail>(
				`/host/packages/${id}/listings/`,
				{ listingIds },
			);
			return res.data;
		} catch (error) {
			handleApiError(error, 'Failed to update package listings');
		}
	},


	// Slot management

	/**
	 * List all slots for a package.
	 * 
	 * Pass isActive / dateFrom to narrow results.
	 *
	 * GET /api/host/packages/{id}/slots/
	 */
	getPackageSlots: async (
		packageId: number,
		params: ListPackageSlotsParams = {},
	): Promise<PackageSlot[]> => {
		try {
			const res = await api.get<PaginatedResponse<PackageSlot> | PackageSlot[]>(
				`/host/packages/${packageId}/slots/`,
				{
					params: {
						...(params.isActive !== undefined ? { is_active: params.isActive } : {}),
						...(params.dateFrom ? { date_from: params.dateFrom } : {}),
						...(params.page ? { page: params.page } : {}),
					},
				},
			);
			const data = res.data;
			// Handle both plain array and paginated response
			if (Array.isArray(data)) {
				return data;
			}
			return data?.results || [];
		} catch (error) {
			handleApiError(error, 'Failed to fetch package slots');
		}
	},

	/**
	 * Manually create a one-off departure slot.
	 * 
	 * end_date must be ≥ start_date; start_date must be unique per package.
	 *
	 * POST /api/host/packages/{id}/slots/
	 */
	createPackageSlot: async (
		packageId: number,
		payload: CreatePackageSlotPayload,
	): Promise<PackageSlot> => {
		try {
			const res = await api.post<PackageSlot>(`/host/packages/${packageId}/slots/`, payload);
			return res.data;
		} catch (error) {
			handleApiError(error, 'Failed to create slot');
		}
	},

	/**
	 * Update a slot's end_date, capacity, or active state.
	 * 
	 * start_date cannot be changed — create a new slot instead.
	 * 
	 * Backend rejects if new capacity < booked_count (capacity_below_booked).
	 *
	 * PATCH /api/host/packages/{id}/slots/{slotId}/
	 */
	updatePackageSlot: async (
		packageId: number,
		slotId: number,
		payload: UpdatePackageSlotPayload,
	): Promise<PackageSlot> => {
		try {
			const res = await api.patch<PackageSlot>(
				`/host/packages/${packageId}/slots/${slotId}/`,
				payload,
			);
			return res.data;
		} catch (error) {
			handleApiError(error, 'Failed to update slot');
		}
	},

	/**
	 * Delete a slot. Blocked if active BookingItem rows reference it
	 * 
	 * (slot_has_active_bookings — deactivate instead).
	 *
	 * DELETE /api/host/packages/{id}/slots/{slotId}/
	 */
	deletePackageSlot: async (packageId: number, slotId: number): Promise<void> => {
		try {
			await api.delete(`/host/packages/${packageId}/slots/${slotId}/`);
		} catch (error) {
			handleApiError(error, 'Failed to delete slot');
		}
	},


	// ── Schedule management ───────────────────────────────────────────────────

	/**
	 * List all schedule templates for a package.
	 *
	 * GET /api/host/packages/{id}/schedules/
	 */
	getPackageSchedules: async (packageId: number): Promise<PackageSchedule[]> => {
		try {
			const res = await api.get<PaginatedResponse<PackageSchedule> | PackageSchedule[]>(
				`/host/packages/${packageId}/schedules/`,
			);
			const data = res.data;
			// Handle both plain array and paginated response
			if (Array.isArray(data)) {
				return data;
			}
			return data?.results || [];
		} catch (error) {
			handleApiError(error, 'Failed to fetch schedules');
		}
	},

	/**
	 * Create a new schedule template.
	 * 
	 * days_of_week: non-empty list of unique ints 0–6 (Mon–Sun).
	 * 
	 * advance_days: 1–365 (default 90).
	 *
	 * POST /api/host/packages/{id}/schedules/
	 */
	createPackageSchedule: async (
		packageId: number,
		payload: CreatePackageSchedulePayload,
	): Promise<PackageSchedule> => {
		try {
			const res = await api.post<PackageSchedule>(
				`/host/packages/${packageId}/schedules/`,
				payload,
			);
			return res.data;
		} catch (error) {
			handleApiError(error, 'Failed to create schedule');
		}
	},

	/**
	 * Partially update a schedule. Existing generated slots are unaffected.
	 *
	 * PATCH /api/host/packages/{id}/schedules/{scheduleId}/
	 */
	updatePackageSchedule: async (
		packageId: number,
		scheduleId: number,
		payload: UpdatePackageSchedulePayload,
	): Promise<PackageSchedule> => {
		try {
			const res = await api.patch<PackageSchedule>(
				`/host/packages/${packageId}/schedules/${scheduleId}/`,
				payload,
			);
			return res.data;
		} catch (error) {
			handleApiError(error, 'Failed to update schedule');
		}
	},

	/**
	 * Delete a schedule template.
	 * 
	 * Already-generated slots are NOT removed — they remain valid and bookable.
	 *
	 * DELETE /api/host/packages/{id}/schedules/{scheduleId}/
	 */
	deletePackageSchedule: async (packageId: number, scheduleId: number): Promise<void> => {
		try {
			await api.delete(`/host/packages/${packageId}/schedules/${scheduleId}/`);
		} catch (error) {
			handleApiError(error, 'Failed to delete schedule');
		}
	},

	/**
	 * Trigger immediate slot generation from all active schedules.
	 * 
	 * Idempotent — safe to call multiple times (uses get_or_create internally).
	 * 
	 * Returns the count of newly created slots (0 if all slots already exist).
	 *
	 * POST /api/host/packages/{id}/generate-slots/
	 */
	generatePackageSlots: async (packageId: number): Promise<GenerateSlotsResult> => {
		try {
			const res = await api.post<GenerateSlotsResult>(
				`/host/packages/${packageId}/generate-slots/`,
				{},
			);
			return res.data;
		} catch (error) {
			handleApiError(error, 'Failed to generate slots');
		}
	},


	// ── Cover image ──────────────────────────────────────────────────────────

	/**
	 * Upload or replace the package cover image.
	 *
	 * POST /api/host/packages/{id}/cover-image/
	 */
	uploadCoverImage: async (id: number, file: File): Promise<PackageDetail> => {
		try {
			const formData = new FormData();
			formData.append('cover_image', file);
			const res = await api.post<PackageDetail>(
				`/host/packages/${id}/cover-image/`,
				formData,
				{ headers: { 'Content-Type': 'multipart/form-data' } },
			);
			return res.data;
		} catch (error) {
			handleApiError(error, 'Failed to upload cover image');
		}
	},

	/**
	 * Remove the package cover image.
	 *
	 * DELETE /api/host/packages/{id}/cover-image/
	 */
	removeCoverImage: async (id: number): Promise<void> => {
		try {
			await api.delete(`/host/packages/${id}/cover-image/`);
		} catch (error) {
			handleApiError(error, 'Failed to remove cover image');
		}
	},


	// Exception management

	/**
	 * List all date exceptions for a package.
	 *
	 * GET /api/host/packages/{id}/exceptions/
	 */
	getPackageExceptions: async (packageId: number): Promise<PackageSlotException[]> => {
		try {
			const res = await api.get<PaginatedResponse<PackageSlotException> | PackageSlotException[]>(
				`/host/packages/${packageId}/exceptions/`,
			);
			const data = res.data;
			// Handle both plain array and paginated response
			if (Array.isArray(data)) {
				return data;
			}
			return data?.results || [];
		} catch (error) {
			handleApiError(error, 'Failed to fetch exceptions');
		}
	},

	/**
	 * Create a date exception (close a date or override its capacity).
	 * 
	 * Rules: either isClosed=true OR capacityOverride must be set (not both null/false).
	 * 
	 * One exception per (package, date) — 409 exception_already_exists otherwise.
	 *
	 * POST /api/host/packages/{id}/exceptions/
	 */
	createPackageException: async (
		packageId: number,
		payload: CreatePackageExceptionPayload,
	): Promise<PackageSlotException> => {
		try {
			const res = await api.post<PackageSlotException>(
				`/host/packages/${packageId}/exceptions/`,
				payload,
			);
			return res.data;
		} catch (error) {
			handleApiError(error, 'Failed to create exception');
		}
	},

	/**
	 * Partially update an exception (date is immutable after creation).
	 *
	 * PATCH /api/host/packages/{id}/exceptions/{exceptionId}/
	 */
	updatePackageException: async (
		packageId: number,
		exceptionId: number,
		payload: UpdatePackageExceptionPayload,
	): Promise<PackageSlotException> => {
		try {
			const res = await api.patch<PackageSlotException>(
				`/host/packages/${packageId}/exceptions/${exceptionId}/`,
				payload,
			);
			return res.data;
		} catch (error) {
			handleApiError(error, 'Failed to update exception');
		}
	},

	/**
	 * Delete a date exception, restoring normal schedule behaviour for that date.
	 *
	 * DELETE /api/host/packages/{id}/exceptions/{exceptionId}/
	 */
	deletePackageException: async (packageId: number, exceptionId: number): Promise<void> => {
		try {
			await api.delete(`/host/packages/${packageId}/exceptions/${exceptionId}/`);
		} catch (error) {
			handleApiError(error, 'Failed to delete exception');
		}
	},
};

export default packagesService;
