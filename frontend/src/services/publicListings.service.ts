/**
 * Public Listings Service
 * -----------------------
 * API methods for public listing browsing, availability, and public slot lookup.
 */

import api from '@services/api.service';
import type { AxiosError } from 'axios';
import { extractApiError } from '@utils/apiError';
import type {
	PaginatedResponse,
	ListingDetail,
	PublicListing,
	PublicListingsParams,
} from '@/types/listings';
import type { ActivitySlot, AvailabilityStatus } from '@/types/bookings';

const publicListingsService = {
	/**
	 * Fetch public, bookable listings with filters/search/pagination.
	 * GET /api/listings/
	 */
	getPublicListings: async (
		params: PublicListingsParams = {},
	): Promise<PaginatedResponse<PublicListing>> => {
		try {
			const res = await api.get<PaginatedResponse<PublicListing>>(
				'/listings/',
				{
					params: {
						...(params.search ? { search: params.search } : {}),
						...(params.category ? { category: params.category } : {}),
						...(params.activityType ? { activity_type: params.activityType } : {}),
						...(params.difficultyLevel ? { difficulty_level: params.difficultyLevel } : {}),
						...(params.destination ? { destination: params.destination } : {}),
						...(params.minPrice ? { min_price: params.minPrice } : {}),
						...(params.maxPrice ? { max_price: params.maxPrice } : {}),
						...(params.minDays ? { min_days: params.minDays } : {}),
						...(params.maxDays ? { max_days: params.maxDays } : {}),
						...(params.minDuration ? { min_duration: params.minDuration } : {}),
						...(params.maxDuration ? { max_duration: params.maxDuration } : {}),
						...(params.instantBooking ? { instant_booking: true } : {}),
						...(params.hostVerified ? { host_verified: true } : {}),
						...(params.minRating ? { min_rating: params.minRating } : {}),
						...(params.idealFor ? { ideal_for: params.idealFor } : {}),
						...(params.bestSeason ? { best_season: params.bestSeason } : {}),
						...(params.tag ? { tag: params.tag } : {}),
						...(params.ordering ? { ordering: params.ordering } : {}),
						...(params.page ? { page: params.page } : {}),
					},
				},
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to fetch listings');
		}
	},

	/**
	 * Fetch a single listing by slug (public, SEO-friendly).
	 * GET /api/listings/by-slug/<slug>/
	 */
	getPublicListingBySlug: async (slug: string): Promise<ListingDetail> => {
		try {
			const res = await api.get<ListingDetail>(`/listings/by-slug/${slug}/`);
			return res.data;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 404)
				throw new Error('Listing not found or no longer available');
			return extractApiError(error,'Failed to fetch listing');
		}
	},

	/**
	 * Per-day availability status for a listing month (powers the date-picker calendar dots).
	 * GET /api/listings/<id>/availability/
	 */
	getAvailability: async (
		listingId:      number,
		year:           number,
		month:          number,   // 1–12
		travellerCount: number,
	): Promise<Record<string, AvailabilityStatus>> => {
		try {
			const res = await api.get<Record<string, AvailabilityStatus>>(
				`/listings/${listingId}/availability/`,
				{ params: { year, month, traveller_count: travellerCount } },
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to fetch availability');
		}
	},

	/**
	 * Public slots for a listing, optionally filtered by date.
	 * GET /api/listings/<id>/slots/
	 */
	getPublicSlots: async (listingId: number, date?: string): Promise<ActivitySlot[]> => {
		try {
			const res = await api.get<ActivitySlot[] | { results: ActivitySlot[] }>(
				`/listings/${listingId}/slots/`,
				{ params: date ? { date } : {} },
			);
			const data = res.data;
			return Array.isArray(data) ? data : (data.results ?? []);
		} catch (error: unknown) {
			return extractApiError(error,'Failed to fetch slots');
		}
	},
};

export default publicListingsService;
