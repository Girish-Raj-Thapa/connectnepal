/**
 * Profile Service
 * Handles profile updates and password changes for the authenticated user.
 */

import api from '@services/api.service';
import { extractApiError } from '@utils/apiError';
import type {
	Account,
	UpdateProfileRequest,
	ChangePasswordRequest,
	ChangePasswordResponse,
	HostProfile,
	UpdateHostProfileRequest,
	HostDocument,
	UploadHostDocumentsRequest,
	UploadHostDocumentsResponse,
} from '@/types/accounts';
import type {
	TravellerPreferencesRequest,
	TravellerPreferencesReadResponse,
} from '@/types/onboarding';



const profileService = {
	/**
	 * PATCH /api/accounts/me/
     * 
	 * Update the authenticated user's profile.
     * 
	 * Sends as multipart/form-data when profilePhoto is included.
	 */
	updateProfile: async (data: UpdateProfileRequest): Promise<Account> => {
		try {
			const hasFile = data.profilePhoto instanceof File;

			if (hasFile) {
				// Use FormData for file upload — manually snake_case keys
				// because the axios interceptor doesn't transform FormData objects
				const formData = new FormData();
				if (data.firstName !== undefined) formData.append('first_name', data.firstName);
				if (data.middleName !== undefined) formData.append('middle_name', data.middleName);
				if (data.lastName !== undefined) formData.append('last_name', data.lastName);
				if (data.phone !== undefined) formData.append('phone', data.phone);
				if (data.dateOfBirth !== undefined) formData.append('date_of_birth', data.dateOfBirth);
				if (data.gender !== undefined) formData.append('gender', data.gender);
				if (data.address !== undefined) formData.append('address', data.address);
				if (data.profilePhoto) formData.append('profile_photo', data.profilePhoto);

				const res = await api.patch<Account>('/accounts/me/', formData, {
					headers: { 'Content-Type': 'multipart/form-data' },
				});
				return res.data;
			}

			// No file — send as JSON (snake_case conversion handled by interceptor)
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { profilePhoto: _, ...jsonData } = data;
			const res = await api.patch<Account>('/accounts/me/', jsonData);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to update profile');
		}
	},

	/**
	 * GET /api/accounts/traveller/preferences/
	 *
	 * Fetch the traveller's current travel preferences.
	 */
	getPreferences: async (): Promise<TravellerPreferencesReadResponse> => {
		try {
			const res = await api.get<TravellerPreferencesReadResponse>('/accounts/traveller/preferences/');
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to load preferences');
		}
	},

	/**
	 * PATCH /api/accounts/traveller/preferences/
	 *
	 * Update the traveller's travel preferences. All fields are optional.
	 */
	updatePreferences: async (data: TravellerPreferencesRequest): Promise<TravellerPreferencesReadResponse> => {
		try {
			const res = await api.patch<TravellerPreferencesReadResponse>('/accounts/traveller/preferences/', data);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to update preferences');
		}
	},

	/**
	 * POST /api/accounts/me/password/
     *
	 * Change the authenticated user's password.
	 */
	changePassword: async (data: ChangePasswordRequest): Promise<ChangePasswordResponse> => {
		try {
			const res = await api.post<ChangePasswordResponse>('/accounts/me/password/', data);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to change password');
		}
	},

	// ── Host profile ─────────────────────────────────────────────────────────

	/**
	 * GET /api/accounts/host/profile/
	 *
	 * Fetch the host's business profile and verification status.
	 */
	getHostProfile: async (): Promise<HostProfile> => {
		try {
			const res = await api.get<HostProfile>('/accounts/host/profile/');
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to load business profile');
		}
	},

	/**
	 * PATCH /api/accounts/host/profile/
	 *
	 * Update business name, address, phone, about_service.
	 */
	updateHostProfile: async (data: UpdateHostProfileRequest): Promise<HostProfile> => {
		try {
			const res = await api.patch<HostProfile>('/accounts/host/profile/', data);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to update business profile');
		}
	},

	/**
	 * GET /api/accounts/host/documents/
	 *
	 * List the host's uploaded verification documents.
	 */
	getHostDocuments: async (): Promise<HostDocument[]> => {
		try {
			const res = await api.get<HostDocument[]>('/accounts/host/documents/');
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to load documents');
		}
	},

	/**
	 * POST /api/accounts/host/documents/
	 *
	 * Upload or replace verification documents (multipart).
	 * At least one file must be provided.
	 */
	uploadHostDocuments: async (data: UploadHostDocumentsRequest): Promise<UploadHostDocumentsResponse> => {
		try {
			const formData = new FormData();
			if (data.citizenshipFile) formData.append('citizenship_file', data.citizenshipFile);
			if (data.panFile) formData.append('pan_file', data.panFile);
			if (data.businessLicenseFile) formData.append('business_license_file', data.businessLicenseFile);

			const res = await api.post<UploadHostDocumentsResponse>(
				'/accounts/host/documents/',
				formData,
				{ headers: { 'Content-Type': 'multipart/form-data' } },
			);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to upload documents');
		}
	},
};

export default profileService;
