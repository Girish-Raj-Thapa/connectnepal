import type { PaginatedResponse } from './listings';

// ============================================================================
// Domain Models
// ============================================================================

export type ChatIntent =
	| 'faq_help'
	| 'listing_explain'
	| 'package_explain'
	| 'general_suggestion'
	| 'booking_info'
	| 'personalized_recommendation'
	| 'fallback';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
	id: string;
	role: ChatRole;
	content: string;
	intent?: string;
	createdAt?: string;
	pending?: boolean;
	failed?: boolean;
}

export interface ChatSessionSummary {
	id: number;
	title: string;
	createdAt: string;
	updatedAt: string;
	messageCount: number;
}

export interface ChatHistoryMessage {
	role: ChatRole;
	content: string;
	intent: string;
	createdAt: string;
}

export interface ChatSessionDetail {
	id: number;
	title: string;
	createdAt: string;
	messages: ChatHistoryMessage[];
}

// ============================================================================
// API Request Types
// ============================================================================

export interface SendMessageRequest {
	message: string;
	sessionId?: number | null;
	listingId?: number | null;
	packageId?: number | null;
	guestSessionId?: string | null;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface SendMessageResponse {
	reply: string;
	sessionId: number;
	intent: string;
}

export type PaginatedChatSessions = PaginatedResponse<ChatSessionSummary>;
