/**
 * Onboarding Types
 * ----------------
 * Type definitions for onboarding flows.
 *
 * Architecture:
 * - Request/Response types = API contract (used by services)
 * - Form types = Yup InferType (used by components, defined in validators/onboarding.ts)
 */


// ============================================================================
// Domain Models
// ============================================================================

export interface OnboardingStatus {
    hasCompletedOnboarding: boolean;
    currentStep: number;
    role: string;
    nextStepUrl: string | null;
}


// ============================================================================
// API Request Types
// ============================================================================

export interface BasicProfileRequest {
    firstName: string;
    lastName: string;
	phone: string;
	country: string;
	city: string;
	middleName?: string;
	dateOfBirth?: string;
	gender?: string;
	address?: string;
	profilePhoto?: File;
}

export interface TravellerPreferencesRequest {
	emergencyContact?: string;
	preferredActivities?: string[];
	preferredMinBudget?: string | null;
	preferredMaxBudget?: string | null;
	preferredTripStyle?: string;
}

export interface TravellerPreferencesReadResponse {
	emergencyContact: string | null;
	preferredActivities: string[];
	preferredMinBudget: string | null;
	preferredMaxBudget: string | null;
	preferredTripStyle: string | null;
}


// Host 
export interface HostBusinessInfoRequest {
    businessName: string;
    businessAddress: string;
    businessPhone?: string;
	aboutService?: string;
}


export interface HostDocumentsRequest {
    citizenshipFile?: File;
    panFile?: File;
    businessLicenseFile?: File;
}

// ============================================================================
// API Response Types
// ============================================================================
export interface OnboardingStepResponse {
    message: string;
    nextStep?: string;
    redirectTo?: string;
    verificationStatus?: string;
	canUploadDocuments?: boolean;
	skipTo?: string;
}

export interface HostDocumentsResponse {
    message: string;
	totalDocuments: number;
	verificationStatus: string;
	note?: string;
}
