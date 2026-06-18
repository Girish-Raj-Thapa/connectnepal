/**
 * Admin Service
 * Handles admin-only API calls for host verification, user management,
 * and booking oversight.
 */

import api from '@services/api.service';
import { extractApiError } from '@utils/apiError';
import type {
	AdminHostDetail,
	PaginatedAdminHosts,
	RejectHostPayload,
	AdminUserDetail,
	PaginatedAdminUsers,
	BlockUserPayload,
	AdminBookingDetail,
	PaginatedAdminBookings,
	CancelBookingPayload,
	HostFilterParams,
	UserFilterParams,
	AdminBookingFilterParams,
} from '@/types/admin';



// ============================================================================
// Host Verification
// ============================================================================

export const AdminHostService = {
	
    /** 
     * GET /api/accounts/admin/hosts/ 
     */
	list: async (filters: HostFilterParams = {}): Promise<PaginatedAdminHosts> => {
		try {
			const params: Record<string, string | number> = {};
			if (filters.page) params.page = filters.page;
			if (filters.verificationStatus) params.verification_status = filters.verificationStatus;

			const res = await api.get<PaginatedAdminHosts>('/accounts/admin/hosts/', { params });
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to load hosts');
		}
	},

	/** 
     * GET /api/accounts/admin/hosts/<id>/ 
     */
	getDetail: async (id: number): Promise<AdminHostDetail> => {
		try {
			const res = await api.get<AdminHostDetail>(`/accounts/admin/hosts/${id}/`);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to load host details');
		}
	},

	/** 
     * POST /api/accounts/admin/hosts/<id>/approve/ 
     */
	approve: async (id: number): Promise<void> => {
		try {
			await api.post(`/accounts/admin/hosts/${id}/approve/`);
		} catch (error) {
			return extractApiError(error, 'Failed to approve host');
		}
	},

	/** 
     * POST /api/accounts/admin/hosts/<id>/reject/ 
     */
	reject: async (id: number, payload: RejectHostPayload): Promise<void> => {
		try {
			await api.post(`/accounts/admin/hosts/${id}/reject/`, payload);
		} catch (error) {
			return extractApiError(error, 'Failed to reject host');
		}
	},
};

// ============================================================================
// User Management
// ============================================================================

export const AdminUserService = {
	/** 
     * GET /api/accounts/admin/users/ 
     */
	list: async (filters: UserFilterParams = {}): Promise<PaginatedAdminUsers> => {
		try {
			const params: Record<string, string | number | boolean> = {};
			if (filters.page) params.page = filters.page;
			if (filters.role) params.role = filters.role;
			if (filters.isActive !== undefined) params.is_active = filters.isActive;
			if (filters.search) params.search = filters.search;

			const res = await api.get<PaginatedAdminUsers>('/accounts/admin/users/', { params });
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to load users');
		}
	},

	/** 
     * GET /api/accounts/admin/users/<id>/ 
     */
	getDetail: async (id: number): Promise<AdminUserDetail> => {
		try {
			const res = await api.get<AdminUserDetail>(`/accounts/admin/users/${id}/`);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to load user details');
		}
	},

	/** 
     * POST /api/accounts/admin/users/<id>/block/ 
     */
	block: async (id: number, payload?: BlockUserPayload): Promise<void> => {
		try {
			await api.post(`/accounts/admin/users/${id}/block/`, payload ?? {});
		} catch (error) {
			return extractApiError(error, 'Failed to block user');
		}
	},

	/** 
     * POST /api/accounts/admin/users/<id>/unblock/ 
     */
	unblock: async (id: number): Promise<void> => {
		try {
			await api.post(`/accounts/admin/users/${id}/unblock/`);
		} catch (error) {
			return extractApiError(error, 'Failed to unblock user');
		}
	},
};

// ============================================================================
// Admin Booking Management
// ============================================================================

export const AdminBookingService = {
	/** 
     * GET /api/admin/bookings/ 
     */
	list: async (filters: AdminBookingFilterParams = {}): Promise<PaginatedAdminBookings> => {
		try {
			const params: Record<string, string | number> = {};
			if (filters.page) params.page = filters.page;
			if (filters.status) params.status = filters.status;
			if (filters.source) params.source = filters.source;
			if (filters.paymentStatus) params.payment_status = filters.paymentStatus;
			if (filters.dateFrom) params.date_from = filters.dateFrom;
			if (filters.dateTo) params.date_to = filters.dateTo;
			if (filters.search) params.search = filters.search;

			const res = await api.get<PaginatedAdminBookings>('/admin/bookings/', { params });
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to load bookings');
		}
	},

	/** 
     * GET /api/admin/bookings/<id>/ 
     */
	getDetail: async (id: number): Promise<AdminBookingDetail> => {
		try {
			const res = await api.get<AdminBookingDetail>(`/admin/bookings/${id}/`);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to load booking details');
		}
	},

	/** 
     * POST /api/admin/bookings/<id>/cancel/ 
     */
	cancel: async (id: number, payload?: CancelBookingPayload): Promise<void> => {
		try {
			await api.post(`/admin/bookings/${id}/cancel/`, payload ?? {});
		} catch (error) {
			return extractApiError(error, 'Failed to cancel booking');
		}
	},
};
