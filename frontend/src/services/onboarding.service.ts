/**
 * Onboarding Service
 * ------------------
 * API methods for the onboarding flow.
 *
 * - Onboarding status check
 * - Traveller basic profile (step 1)
 * - Traveller preferences (step 2)
 */

import api from '@services/api.service';
import { extractApiError } from '@utils/apiError';
import type {
	OnboardingStatus,
	BasicProfileRequest,
	TravellerPreferencesRequest,
	HostBusinessInfoRequest,
	HostDocumentsRequest,
	OnboardingStepResponse,
	HostDocumentsResponse,
} from '@/types/onboarding';


const onboardingService = {
    /**
	 * Fetch current onboarding status.
	 * GET /api/accounts/onboarding/status/
	 */
    getStatus: async (): Promise<OnboardingStatus> => {
		try {
			const res = await api.get<OnboardingStatus>(
				'/accounts/onboarding/status/',
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to fetch onboarding status');
		}
	},


    /**
	 * Submit traveller basic profile (step 1).
	 * PATCH /api/accounts/onboarding/traveller/basic-profile/
	 *
	 * Uses FormData for profile photo upload.
	*/
    submitTravellerBasicProfile: async (
		data: BasicProfileRequest,
	): Promise<OnboardingStepResponse> => {
		try {
			const formData = new FormData();
			formData.append('first_name', data.firstName);
			formData.append('last_name', data.lastName);
			formData.append('phone', data.phone);
			formData.append('country', data.country);
			formData.append('city', data.city);
			if (data.middleName) formData.append('middle_name', data.middleName);
			if (data.dateOfBirth)
				formData.append('date_of_birth', data.dateOfBirth);
			if (data.gender) formData.append('gender', data.gender);
			if (data.address) formData.append('address', data.address);
			if (data.profilePhoto)
				formData.append('profile_photo', data.profilePhoto);

			const res = await api.patch<OnboardingStepResponse>(
				'/accounts/onboarding/traveller/basic-profile/',
				formData,
				{ headers: { 'Content-Type': 'multipart/form-data' } },
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to save profile');
		}
	},


    /**
	 * Submit traveller preferences (step 2, completes onboarding).
	 * POST /api/accounts/onboarding/traveller/preferences/
	 */
	submitTravellerPreferences: async (
		data: TravellerPreferencesRequest,
	): Promise<OnboardingStepResponse> => {
		try {
			const res = await api.post<OnboardingStepResponse>(
				'/accounts/onboarding/traveller/preferences/',
				data,
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to save preferences');
		}
	},


	/**
	 * Submit host basic profile (step 1).
	 * PATCH /api/accounts/onboarding/host/basic-profile/
	 *
	 * Uses FormData for optional profile photo upload.
	 */
	submitHostBasicProfile: async (
		data: BasicProfileRequest,
	): Promise<OnboardingStepResponse> => {
		try {
			const formData = new FormData();
			formData.append('first_name', data.firstName);
			formData.append('last_name', data.lastName);
			formData.append('phone', data.phone);
			if (data.address) formData.append('address', data.address);
			if (data.profilePhoto)
				formData.append('profile_photo', data.profilePhoto);

			const res = await api.patch<OnboardingStepResponse>(
				'/accounts/onboarding/host/basic-profile/',
				formData,
				{ headers: { 'Content-Type': 'multipart/form-data' } },
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to save profile');
		}
	},


	/**
	 * Submit host business info (step 2, completes onboarding).
	 * POST /api/accounts/onboarding/host/business-info/
	 *
	 * Regular JSON body — no file uploads
	 */
	submitHostBusinessInfo: async (
		data: HostBusinessInfoRequest,
	): Promise<OnboardingStepResponse> => {
		try {
			const res = await api.post<OnboardingStepResponse>(
				'/accounts/onboarding/host/business-info/',
				data,
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to save business info');
		}
	},


	/**
	 * Upload host verification documents (optional step 3).
	 * POST /api/accounts/onboarding/host/documents/
	 *
	 * Uses FormData for file uploads.
	 * At least one file must be provided per request.
	 * Allowed formats: JPEG, PNG, WebP. Max 2MB each.
	 */
	submitHostDocuments: async (
		data: HostDocumentsRequest,
	): Promise<HostDocumentsResponse> => {
		try {
			const formData = new FormData();
			if (data.citizenshipFile)
				formData.append('citizenship_file', data.citizenshipFile);
			if (data.panFile)
				formData.append('pan_file', data.panFile);
			if (data.businessLicenseFile)
				formData.append('business_license_file', data.businessLicenseFile);

			const res = await api.post<HostDocumentsResponse>(
				'/accounts/onboarding/host/documents/',
				formData,
				{ headers: { 'Content-Type': 'multipart/form-data' } },
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to upload documents');
		}
	},
};

export default onboardingService;
