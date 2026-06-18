/**
 * Reviews Type Definitions
 */

import type { PaginatedResponse } from './listings';

// Status Enums

export type ReviewStatus = 'published' | 'under_review' | 'removed' | 'user_deleted';
export type HostReplyStatus = 'none' | 'published' | 'removed';


// Core Models 

export interface ReviewTraveller {
	id: number;
	firstName: string;
}


export interface Review {
	id: number;
	traveller: ReviewTraveller;
	listingId: number | null;
	packageId: number | null;
	listingTitle: string | null;
	packageTitle: string | null;
	rating: number; // 1–5
	comment: string;
	status: ReviewStatus;
	// Host reply
	hostReply: string;
	hostReplyStatus: HostReplyStatus;
	hostRepliedAt: string | null; // ISO 8601
	hasReply: boolean;
	// Edit tracking
	editedAt: string | null; // ISO 8601
	editCount: number;
	// Permissions (computed by backend per-request)
	canEdit: boolean;
	canDelete: boolean;
	// Timestamps
	createdAt: string; // ISO 8601
}


/**
 * Host inbox review — same as Review + listing/package title + host-specific fields
 */
export interface HostInboxReview extends Review {
	canReply: boolean;
	reportCount: number;
}

export interface ReportSubmissionResponse {
	message: string;
}

/**
 * POST /api/reviews/ request body
 */
export interface CreateReviewPayload {
	bookingItemId: number;
	rating: number; // 1–5
	comment?: string;
}

/**
 * PUT/PATCH /api/reviews/{id}/ request body
 * At least one field must be provided
 */
export interface UpdateReviewPayload {
	rating?: number;
	comment?: string;
}

/**
 * POST /api/host/reviews/{id}/reply/ request body
 */
export interface HostReplyPayload {
	reply: string; // non-blank, max 2000 chars
}

/**
 * POST /api/host/reviews/{id}/report/ or /reply/report/
 */
export type ReportReason =
	| 'abusive_language' | 'hate_speech' | 'threats' | 'spam' |  'irrelevant_content' | 'fraudulent_claim' | 'privacy_violation' | 'other';

export interface ReportReviewPayload {
	reason: ReportReason;
	details? : string;
}

/**
 * POST /api/admin/reviews/{id}/moderate/
 */
export interface AdminModeratePayload {
	action: 'mark_published' | 'mark_under_review' | 'mark_removed';
	note?: string;
}

/**
 * POST /api/admin/reviews/{id}/reply/moderate/
 */
export interface AdminModerateReplyPayload {
	action: 'remove_reply' | 'keep_reply';
	note?: string;
}


// Admin Report Model 

export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface ReviewReport {
	id: number;
	reviewId: number;
	reviewRating: number;
	reviewComment: string;
	reviewStatus: ReviewStatus;
	reporterEmail: string;
	targetType: 'review' | 'host_reply';
	reason: ReportReason;
	details: string;
	status: ReportStatus;
	createdAt: string;
	resolvedAt: string | null;
	resolvedByEmail: string | null;
	resolutionNote: string;
}


// Re-export pagination from listings for convenience
export type { PaginatedResponse };
