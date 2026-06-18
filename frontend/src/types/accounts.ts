/**
 * Account Types
 * -------------
 * Type definitions for user accounts and authentication.
 *
 * Architecture:
 * - Request/Response types = API contract (used by services)
 * - Form types = Yup InferType (used by components, defined in validators.ts)
 */

export type UserRole = 'traveller' | 'host' | 'admin';

// ============================================================================
// Domain Models
// ============================================================================

export interface Account {
	userId: number;
	email: string;
	firstName?: string | null;
	middleName?: string | null;
	lastName?: string | null;
	fullName?: string | null;
	phone?: string | null;
	dateOfBirth?: string | null;
	gender?: string | null;
	address?: string | null;
	country?: string | null;
	city?: string | null;
	role: UserRole;
	hasCompletedOnboarding: boolean;
	onboardingStep: number;
	profilePhoto?: string | null;
	verificationStatus?: 'not_submitted' | 'pending' | 'approved' | 'rejected';
}

// ============================================================================
// API Request Types
// ============================================================================

export interface LoginRequest {
	email: string;
	password: string;
}

export interface RegisterRequest {
	email: string;
	password: string;
	confirmPassword: string;
	role: UserRole;
}

export interface ForgotPasswordRequest {
	email: string;
}

export interface ResetPasswordRequest {
	newPassword: string;
	confirmPassword: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface LoginResponse {
	access: string;
	user: Account;
}

export interface RegisterResponse {
	message: string;
}

export interface PasswordResetResponse {
	message: string;
}

export interface ActivateAccountResponse {
	message: string;
}


// ============================================================================
// Profile Update Types
// ============================================================================

export interface UpdateProfileRequest {
	firstName?: string;
	middleName?: string;
	lastName?: string;
	phone?: string;
	dateOfBirth?: string;
	gender?: string;
	address?: string;
	profilePhoto?: File;
}

export interface ChangePasswordRequest {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
}

export interface ChangePasswordResponse {
	message: string;
}

// ============================================================================
// Host Profile Types
// ============================================================================

export type HostVerificationStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export interface HostProfile {
	businessName: string | null;
	businessAddress: string | null;
	businessPhone: string | null;
	aboutService: string | null;
	verificationStatus: HostVerificationStatus;
	verificationRemarks: string | null;
	isVerified: boolean;
}

export interface UpdateHostProfileRequest {
	businessName?: string;
	businessAddress?: string;
	businessPhone?: string;
	aboutService?: string;
}

export interface HostDocument {
	id: number;
	documentType: 'citizenship' | 'pan' | 'business_license';
	documentTypeDisplay: string;
	fileUrl: string;
	uploadedAt: string;
	updatedAt: string;
}

export interface UploadHostDocumentsRequest {
	citizenshipFile?: File;
	panFile?: File;
	businessLicenseFile?: File;
}

export interface UploadHostDocumentsResponse {
	message: string;
	totalDocuments: number;
	verificationStatus: HostVerificationStatus;
	note: string;
}
