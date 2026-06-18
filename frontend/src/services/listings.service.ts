/**
 * Listings Service
 * ----------------
 * API methods for host listing management.
 * Uses the shared Axios client.
 */

import api from '@services/api.service';
import { extractApiError } from '@utils/apiError';
import type {
	PaginatedResponse,
	MyListing,
	MyListingsParams,
	HostLimits,
    ListingDetail,
    CreateListingRequest,
    UpdateListingRequest,
} from '@/types/listings';


const listingsService = {
	/**
	 * Fetch a single listing owned by the authenticated host.
	 *
	 * GET /api/listings/host/<id>/
	 */
	getMyListing: async (id: number): Promise<ListingDetail> => {
		try {
			const res = await api.get<ListingDetail>(`/listings/host/${id}/`);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to fetch listing');
		}
	},

    /**
	 * Fetch the authenticated host's listings.
     *
	 * GET /api/listings/host/
	 */
    getMyListings: async (
        params: MyListingsParams
    ): Promise<PaginatedResponse<MyListing>> => {
        try {
            const res = await api.get<PaginatedResponse<MyListing>>(
                '/listings/host/',
                {
                    params: {
                        ...(params.search ? { search: params.search } : {}),
                        ...(params.category ? { category: params.category } : {}),
                        ...(params.ordering ? { ordering: params.ordering } : {}),
                        ...(params.page ? { page: params.page } : {}),
						...(params.isBookable !== undefined ? { is_bookable: params.isBookable } : {}),
                    },
                },
            );
            return res.data;
        } catch (error: unknown) {
            return extractApiError(error,'Failed to fetch listings');
        }
    },


    /**
	 * Fetch creation limits for the authenticated host.
     *
	 * GET /api/listings/host/limits/
	*/
    getMyLimits: async (): Promise<HostLimits> => {
        try {
            const res = await api.get<HostLimits>('/listings/host/limits/');
            return res.data;
        } catch (error: unknown) {
            return extractApiError(error,'Failed to fetch limits');
        }
    },

    /**
	 * Soft-delete a listing.
     *
	 * DELETE /api/listings/host/<id>/delete/
	 */
	deleteListing: async (id: number): Promise<void> => {
		try {
			await api.delete(`/listings/host/${id}/delete/`);
		} catch (error: unknown) {
			return extractApiError(error,'Failed to delete listing');
		}
	},


    /**
	 * Create a new listing (starts hidden from public).
     *
	 * POST /api/listings/host/create/
	 */
    createListing: async (data: CreateListingRequest): Promise<ListingDetail> => {
        try {
            const res = await api.post<ListingDetail>('/listings/host/create/', data);
            return res.data;
        } catch (error: unknown) {
            return extractApiError(error,'Failed to create listing');
        }
    },


    /**
	 * Partially update an existing listing.
     *
	 * PATCH /api/listings/host/<id>/
	 */
	updateListing: async (
		id: number,
		data: UpdateListingRequest,
	): Promise<ListingDetail> => {
		try {
			const res = await api.patch<ListingDetail>(
				`/listings/host/${id}/`,
				data,
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to update listing');
		}
	},


    /**
	 * Upload an image to a listing.
     *
	 * POST /api/listings/host/<id>/images/
	 *
	 * Uses FormData with explicit snake_case keys (bypasses auto-transform).
	 */
	uploadListingImage: async (
		listingId: number,
		file: File,
		opts?: { isPrimary?: boolean; caption?: string; order?: number },
	): Promise<void> => {
		try {
			const formData = new FormData();
			formData.append('image', file);
			if (opts?.isPrimary) formData.append('is_primary', 'true');
			if (opts?.caption) formData.append('caption', opts.caption);
			if (opts?.order !== undefined)
				formData.append('order', String(opts.order));

			await api.post(
				`/listings/host/${listingId}/images/`,
				formData,
				{ headers: { 'Content-Type': 'multipart/form-data' } },
			);
		} catch (error: unknown) {
			return extractApiError(error,'Failed to upload image');
		}
	},


    /**
	 * Delete an image from a listing.
     *
	 * DELETE /api/listings/host/<listingId>/images/<imageId>/
	 */
	deleteListingImage: async (
		listingId: number,
		imageId: number,
	): Promise<void> => {
		try {
			await api.delete(
				`/listings/host/${listingId}/images/${imageId}/`,
			);
		} catch (error: unknown) {
			return extractApiError(error,'Failed to delete image');
		}
	},


    /**
	 * Set an image as the primary image for a listing.
     *
	 * POST /api/listings/host/<listingId>/images/<imageId>/set-primary/
	 */
	setPrimaryImage: async (
		listingId: number,
		imageId: number,
	): Promise<void> => {
		try {
			await api.post(
				`/listings/host/${listingId}/images/${imageId}/set-primary/`,
			);
		} catch (error: unknown) {
			return extractApiError(error,'Failed to set primary image');
		}
	},
};

export default listingsService;
