import api from '@services/api.service';
import type { RecommendationListing } from '@/types/listings';
import type { RecommendedPackage } from '@/types/packages';
import {
	normalizeRecommendationMeta,
	type RecommendationMeta,
	type RecommendationStrategy,
} from '@utils/recommendationMeta';

// Session ID

const SESSION_ID_KEY = 'reco_session_id';

export function getRecommendationSessionId(): string {
	let sessionId = localStorage.getItem(SESSION_ID_KEY);
	if (!sessionId) {
		sessionId = crypto.randomUUID();
		localStorage.setItem(SESSION_ID_KEY, sessionId);
	}
	return sessionId;
}

// Event types

export type RecommendationEventType = 'impression' | 'click' | 'detail_open';
export type RecommendationSurface = 'similar' | 'for_you';
export type BrowsingInteractionEventType = 'click' | 'detail_open';
export type BrowsingInteractionSurface =
	| 'catalog'
	| 'search_results'
	| 'listing_detail';

export interface RecommendationEvent {
	requestId: string;
	listingId?: number | null;
	eventType: RecommendationEventType;
	surface: RecommendationSurface;
	strategy: RecommendationStrategy;
	modelVersion?: string;
	position?: number | null;
	sessionId?: string;
	metadata?: Record<string, unknown>;
}

export interface BrowsingInteractionEvent {
	listingId: number;
	eventType: BrowsingInteractionEventType;
	surface: BrowsingInteractionSurface;
	position?: number | null;
	metadata?: Record<string, unknown>;
}

export interface RecommendationNavigationContext {
	source: 'recommendation';
	requestId: string;
	listingId: number;
	surface: RecommendationSurface;
	strategy: RecommendationStrategy;
	modelVersion: string;
	usedFallback?: boolean;
	personalizedCount?: number;
	fallbackCount?: number;
	position: number;
}

export interface BrowsingNavigationContext {
	source: 'browse';
	listingId: number;
	surface: BrowsingInteractionSurface;
	position?: number | null;
	metadata?: Record<string, unknown>;
}

export type ListingNavigationContext =
	| RecommendationNavigationContext
	| BrowsingNavigationContext;

export interface ListingNavigationState {
	listingNavigationContext?: ListingNavigationContext | null;
}

interface TrackingBatchResponse {
	accepted: number;
	rejected: number;
	errors: { index: number; detail: string }[];
}

export interface RecommendationResponse<TItem = RecommendationListing> {
	count: number;
	meta: RecommendationMeta;
	results: TItem[];
}

export type PackageRecommendationResponse = RecommendationResponse<RecommendedPackage>;

interface RecommendationApiResponse<TItem = RecommendationListing> {
	count: number;
	meta?: Partial<RecommendationMeta> | null;
	results: TItem[];
}

class RecommendationsService {

	/**
	 * Get similar listings for a given listing (public, no auth needed).
	 */
	static async getSimilarListings(
		listingId: number,
		limit = 6
	): Promise<RecommendationResponse<RecommendationListing>> {
		const response = await api.get<RecommendationApiResponse<RecommendationListing>>(
			`/recommendations/listings/${listingId}/similar/`,
			{ params: { limit, session_id: getRecommendationSessionId() } }
		);
		return {
			...response.data,
			meta: normalizeRecommendationMeta(response.data.meta),
		};
	}

	/**
	 * Get personalized "for you" recommendations (requires authenticated traveller).
	 * Falls back to popular listings if no preferences are set.
	 */
	static async getForYou(limit = 12): Promise<RecommendationResponse> {
		const response = await api.get<RecommendationApiResponse<RecommendationListing>>(
			'/recommendations/for-you/',
			{ params: { limit } }
		);
		return {
			...response.data,
			meta: normalizeRecommendationMeta(response.data.meta),
		};
	}

	/**
	 * Get personalized package recommendations (requires authenticated traveller).
	 * Package cards are rendered without recommendation event tracking in the current MVP.
	 */
	static async getForYouPackages(
		limit = 3
	): Promise<PackageRecommendationResponse> {
		const response = await api.get<RecommendationApiResponse<RecommendedPackage>>(
			'/recommendations/packages/for-you/',
			{ params: { limit } }
		);
		return {
			...response.data,
			meta: normalizeRecommendationMeta(response.data.meta),
		};
	}

	/**
	 * Send interaction events (impression, click, detail_open) to the backend.
	 * Silently ignores errors — tracking must never break the UI.
	 */
	static async sendEvents(events: RecommendationEvent[]): Promise<void> {
		if (events.length === 0) return;
		try {
			await api.post<TrackingBatchResponse>('/recommendations/events/', { events });
		} catch {
			// fire-and-forget — tracking failures are non-critical
		}
	}

	/**
	 * Send non-recommendation browsing interactions to the backend.
	 * Authenticated-only on the backend; failures remain non-blocking on the UI.
	 */
	static async sendInteractions(events: BrowsingInteractionEvent[]): Promise<void> {
		if (events.length === 0) return;
		try {
			await api.post<TrackingBatchResponse>(
				'/recommendations/interactions/',
				{ events }
			);
		} catch {
			// fire-and-forget — tracking failures are non-critical
		}
	}
}

export default RecommendationsService;
export type {
	BehaviorSignalSource,
	RecommendationMeta,
	RecommendationStrategy,
} from '@utils/recommendationMeta';
