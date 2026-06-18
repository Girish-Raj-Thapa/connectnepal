/**
 * Bookings Service
 * ----------------
 * Two namespaces matching the API's role split:
 *   TravellerBookingService — traveller-facing actions
 *   HostBookingService      — host-facing actions
 */

import api from '@services/api.service';
import { extractApiError } from '@utils/apiError';
import type { PaginatedResponse } from '@/types/listings';
import type {
    Booking,
    HostBookingItem,
    BookingQuote,
    QuoteRequest,
    CreateBookingPayload,
    CancelBookingPayload,
    BookFromTripPayload,
    BookingListParams,
    HostBookingListParams,
    CreatePackageBookingPayload,
    PackageErrorCode,
} from '@/types/bookings';


/**
 * Structured error thrown by createPackageBooking.
 * Carries the machine-readable `code` (PackageErrorCode) so the checkout page
 * can map codes to user-facing messages without string-matching `detail`.
 */
export class PackageBookingError extends Error {
    code: PackageErrorCode | undefined;
    detail: string;

    constructor(code: PackageErrorCode | undefined, detail: string) {
        super(detail);
        this.name = 'PackageBookingError';
        this.code = code;
        this.detail = detail;
    }
}



// Traveller Booking Service 

export const TravellerBookingService = {

    /**
     * Compute price/availability breakdown without any DB write.
     * 
     * POST /api/bookings/quote/
     */
    quote: async (payload: QuoteRequest): Promise<BookingQuote> => {
        try {
            const res = await api.post<BookingQuote>('/bookings/quote/', payload);
            return res.data;
        } catch (error) {
            return extractApiError(error, "Failed to Get Price quote");
        }
    },

    /**
     * List the authenticated traveller's bookings (paginated + filtered).
     * 
     * GET /api/bookings/
     * 
     * Note: query params are passed as snake_case because the interceptor only transforms config.data (request body), not config.params.
     */
    list: async (
        params: BookingListParams = {},
    ): Promise<PaginatedResponse<Booking>> => {
        try {
            const res = await api.get<PaginatedResponse<Booking>>('/bookings/', {
                params: {
                    ...(params.status    ? { status:     params.status }    : {}),
                    ...(params.source    ? { source:     params.source }    : {}),
                    ...(params.dateFrom  ? { date_from:  params.dateFrom }  : {}),
                    ...(params.dateTo    ? { date_to:    params.dateTo }    : {}),
                    ...(params.page      ? { page:       params.page }      : {}),
                    ...(params.pageSize  ? { page_size:  params.pageSize }  : {}),
                },
            });
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to fetch bookings');
        }
    },


    /**
     * Create a multi-item booking.
     * 
     * POST /api/bookings/
     * 
     * Sends Idempotency-Key header to prevent duplicate bookings on network retry.
     * 
     * Returns 201 for a new booking, 200 for an idempotency replay.
     */
    create: async (
        payload: CreateBookingPayload,
        idempotencyKey: string,
    ): Promise<Booking> => {
        try {
            const res = await api.post<Booking>('/bookings/', payload, {
                headers: { 'Idempotency-Key': idempotencyKey },
            });
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to create booking');
        }
    },


    /**
     * Get full detail for one booking (owner-only; 404 for other travellers).
     * 
     * GET /api/bookings/<id>/
     */
    getDetail: async (id: number): Promise<Booking> => {
        try {
            const res = await api.get<Booking>(`/bookings/${id}/`);
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to fetch booking details');
        }
    },


    /**
     * Cancel a booking.
     * 
     * POST /api/bookings/<id>/cancel/
     * 
     * Only allowed when booking.status === 'pending_payment'.
     */
    cancel: async (
        id: number,
        payload: CancelBookingPayload,
    ): Promise<Booking> => {
        try {
            const res = await api.post<Booking>(`/bookings/${id}/cancel/`, payload);
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to cancel booking');
        }
    },

    /**
     * Convert selected trip plan items into a booking.
     * 
     * POST /api/bookings/from-trip-plan/<planId>/
     * 
     * Trip plan must be in 'planning' status.
     */
    bookFromTripPlan: async (
        planId: number,
        payload: BookFromTripPayload,
        idempotencyKey: string,
    ): Promise<Booking> => {
        try {
            const res = await api.post<Booking>(
                `/bookings/from-trip-plan/${planId}/`,
                payload,
                { headers: { 'Idempotency-Key': idempotencyKey } },
            );
            return res.data;
        } catch (error) {
            return extractApiError(error, 'Failed to create booking from trip plan');
        }
    },

    /**
     * Book a package with explicit slot selection (preferred) or auto-assign.
     * Always pass packageSlotId when coming from the slot picker UI.
     *
     * Throws PackageBookingError (not a plain Error) so the checkout page can
     * read err.code to map conflict codes to actionable user messages:
     *   package_slot_full          → "This departure is fully booked"
     *   package_no_available_slots → "No departures currently available"
     *   group_size_exceeded        → "Maximum group size is N"
     *   etc. — see PackageErrorCode in bookings.ts
     *
     * POST /api/bookings/
     */
    createPackageBooking: async (
        payload: CreatePackageBookingPayload,
        idempotencyKey: string,
    ): Promise<Booking> => {
        try {
            const res = await api.post<Booking>(
                '/bookings/',
                {
                    packageId: payload.packageId,
                    travellerCount: payload.travellerCount,
                    ...(payload.packageSlotId !== undefined
                        ? { packageSlotId: payload.packageSlotId }
                        : {}),
                },
                { headers: { 'Idempotency-Key': idempotencyKey } },
            );
            return res.data;
        } catch (error) {
            const axiosError = error as import('axios').AxiosError<{
                detail?: string;
                code?: string;
                message?: string;
            }>;
            if (axiosError.response) {
                const code = axiosError.response.data?.code as PackageErrorCode | undefined;
                const detail =
                    axiosError.response.data?.detail ??
                    axiosError.response.data?.message ??
                    'Booking failed. Please try again.';
                throw new PackageBookingError(code, detail);
            }
            if (axiosError.request) {
                throw new PackageBookingError(undefined, 'Network error. Please check your connection.');
            }
            throw new PackageBookingError(undefined, 'An unexpected error occurred');
        }
    },
};


// Host Booking Service 

export const HostBookingService = {

	/**
	 * List booking items for the host's listings (paginated + filtered).
     * 
	 * GET /api/host/bookings/
	 */
	listItems: async (
		params: HostBookingListParams = {},
	): Promise<PaginatedResponse<HostBookingItem>> => {
		try {
			const res = await api.get<PaginatedResponse<HostBookingItem>>(
				'/host/bookings/',
				{
					params: {
						...(params.status       ? { status:        params.status }       : {}),
						...(params.listingId    ? { listing_id:    params.listingId }    : {}),
						...(params.packageId    ? { package_id:    params.packageId }    : {}),
						...(params.durationType ? { duration_type: params.durationType } : {}),
						...(params.dateFrom     ? { date_from:     params.dateFrom }     : {}),
						...(params.dateTo       ? { date_to:       params.dateTo }       : {}),
						...(params.page         ? { page:          params.page }         : {}),
					},
				},
			);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to fetch booking items');
		}
	},

	/**
	 * Get full detail for one booking item (host-only; 404 for other hosts).
     * 
	 * GET /api/host/bookings/<itemId>/
	 */
	getItemDetail: async (itemId: number): Promise<HostBookingItem> => {
		try {
			const res = await api.get<HostBookingItem>(`/host/bookings/${itemId}/`);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to fetch booking item details');
		}
	},

	/**
	 * Mark a booking item as completed.
     * 
	 * POST /api/host/bookings/<itemId>/mark-completed/
     * 
	 * Item must be in 'confirmed' status.
	 */
	markCompleted: async (
		itemId: number,
	): Promise<Pick<HostBookingItem, 'id' | 'status' | 'completedAt'>> => {
		try {
			const res = await api.post<
				Pick<HostBookingItem, 'id' | 'status' | 'completedAt'>
			>(`/host/bookings/${itemId}/mark-completed/`);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to mark booking as completed');
		}
	},
};
