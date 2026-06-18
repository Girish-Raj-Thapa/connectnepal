/**
 * Admin Types
 * Type definitions for admin management pages.
 */

import type { BookingStatus, PaymentStatus } from './bookings';

// ============================================================================
// Host Verification
// ============================================================================

export type HostVerificationStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export interface AdminHostListItem {
	userId: number;
	email: string;
	fullName: string;
	businessName: string;
	verificationStatus: HostVerificationStatus;
	verificationRemarks: string | null;
	verifiedAt: string | null;
	documentCount: number;
}

export interface HostDocument {
	id: number;
	documentType: string;       // e.g. 'citizenship', 'pan', 'business_license'
	filePath: string;
	uploadedAt: string;
}

export interface AdminHostDetail extends AdminHostListItem {
	documents: HostDocument[];
}

export interface PaginatedAdminHosts {
	count: number;
	next: string | null;
	previous: string | null;
	results: AdminHostListItem[];
}

export interface RejectHostPayload {
	remarks: string;
}

// ============================================================================
// User Management
// ============================================================================

export interface AdminUserListItem {
	id: number;
	email: string;
	fullName: string;
	role: 'traveller' | 'host' | 'admin';
	isActive: boolean;
	hasCompletedOnboarding: boolean;
	createdAt: string;
}

export interface AccountStatusLog {
	id: number;
	action: string;
	reason: string | null;
	performedBy: string;
	createdAt: string;
}

export interface TravellerDetail {
	preferredBudget: string | null;
	travelStyle: string | null;
	interests: string[];
}

export interface HostDetail {
	businessName: string | null;
	verificationStatus: HostVerificationStatus;
	totalListings: number;
}

export interface AdminUserDetail extends AdminUserListItem {
	phone: string | null;
	dateOfBirth: string | null;
	gender: string | null;
	address: string | null;
	profilePhoto: string | null;
	travellerDetail: TravellerDetail | null;
	hostDetail: HostDetail | null;
	statusLogs: AccountStatusLog[];
}

export interface PaginatedAdminUsers {
	count: number;
	next: string | null;
	previous: string | null;
	results: AdminUserListItem[];
}

export interface BlockUserPayload {
	reason?: string;
}

// ============================================================================
// Admin Booking Management
// ============================================================================

export interface AdminBookingListItem {
	id: number;
	reference: string;
	status: BookingStatus;
	paymentStatus: PaymentStatus;
	travellerName: string;
	travellerEmail: string;
	itemCount: number;
	quotedTotal: string;
	paidAmount: string;
	currency: string;
	source: string;
	createdAt: string;
}

export type AdminBookingDetail = AdminBookingListItem;

export interface PaginatedAdminBookings {
	count: number;
	next: string | null;
	previous: string | null;
	results: AdminBookingListItem[];
}

export interface CancelBookingPayload {
	note?: string;
}

// ============================================================================
// Filter Params
// ============================================================================

export interface HostFilterParams {
	page?: number;
	verificationStatus?: HostVerificationStatus;
}

export interface UserFilterParams {
	page?: number;
	role?: string;
	isActive?: boolean;
	search?: string;
}

export interface AdminBookingFilterParams {
	page?: number;
	status?: string;
	source?: string;
	paymentStatus?: string;
	dateFrom?: string;
	dateTo?: string;
	search?: string;
}
