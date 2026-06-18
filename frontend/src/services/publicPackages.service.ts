/**
 * Public Packages Service
 * -----------------------
 * Traveller-facing (unauthenticated) package browse endpoints.
 * Base path: /api/packages/  (no host/ prefix — AllowAny permissions)
 *
 * Separate from packagesService which is host-only (/api/host/packages/).
 */

import api from '@services/api.service';
import type { AxiosError } from 'axios';
import type { PaginatedResponse } from '@/types/listings';
import type {
    PublicPackageDetail,
    PublicPackageSlot,
    PackageAvailabilityMonth,
    PublicListPackagesParams,
    PublicPackageListResponse,
    ListPublicPackageSlotsParams,
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


const publicPackagesService = {

    /**
     * Browse published packages with optional filters.
     * 
     * All params are optional — omit for a plain unfiltered list.
     *
     * GET /api/packages/
     */
    listPackages: async (
        params: PublicListPackagesParams = {},
    ): Promise<PublicPackageListResponse> => {
        try {
            const res = await api.get<PublicPackageListResponse>('/packages/', {
                params: {
                    ...(params.search ? { search: params.search } : {}),
                    ...(params.tags ? { tags: params.tags } : {}),
                    ...(params.priceMax ? { price_max: params.priceMax } : {}),
                    ...(params.durationDaysMax  ? { duration_days_max: params.durationDaysMax } : {}),
                    ...(params.ordering ? { ordering: params.ordering } : {}),
                    ...(params.page ? { page: params.page }: {}),
                },
            });
            return res.data;
        } catch (error) {
            handleApiError(error, 'Failed to fetch packages');
        }
    },

    /**
     * Full public detail for a single package.
     * 
     * Includes has_upcoming_slots, next_available_slot, and package_listings.
     *
     * GET /api/packages/{id}/
     */
    getPackageDetail: async (id: number): Promise<PublicPackageDetail> => {
        try {
            const res = await api.get<PublicPackageDetail>(`/packages/${id}/`);
            return res.data;
        } catch (error) {
            handleApiError(error, 'Failed to fetch package details');
        }
    },

    /**
     * List upcoming bookable departure slots.
     * 
     * Defaults to date_from=today on the backend.
     * 
     * Returns a plain array (not paginated).
     *
     * GET /api/packages/{id}/slots/
     */
    getPackageSlots: async (
        id: number,
        params: ListPublicPackageSlotsParams = {},
    ): Promise<PublicPackageSlot[]> => {
        try {
            const res = await api.get<PaginatedResponse<PublicPackageSlot> | PublicPackageSlot[]>(
                `/packages/${id}/slots/`,
                {
                    params: {
                        ...(params.dateFrom ? { date_from: params.dateFrom } : {}),
                        ...(params.dateTo   ? { date_to:   params.dateTo }   : {}),
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
     * Calendar-style availability for a given month.
     * 
     * Every day of the month is present in the response's `days` map.
     * 
     * days[date].available === true means at least one active slot departs that day.
     *
     * GET /api/packages/{id}/availability/?year={year}&month={month}
     */
    getPackageAvailability: async (
        id: number,
        year: number,
        month: number,
    ): Promise<PackageAvailabilityMonth> => {
        try {
            const res = await api.get<PackageAvailabilityMonth>(`/packages/${id}/availability/`, {
                params: { year, month },
            });
            return res.data;
        } catch (error) {
            handleApiError(error, 'Failed to fetch package availability');
        }
    },
};

export default publicPackagesService;
