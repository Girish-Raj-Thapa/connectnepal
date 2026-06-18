/**
 * Auth Service
 * ------------
 * A centralized authentication layer built on top of the Axios API client.
 * Handles:
 *
 * - User registration & account activation
 * - Login & logout
 * - Token refresh workflow
 * - Password reset flows
 * - Fetching current authenticated user
 *
 * All API calls automatically receive:
 * - camelCase ⇄ snake_case key transforms via Axios interceptors
 * - Authorization headers via API client
 */

import api from '@services/api.service';
import type { AxiosError } from 'axios';
import { extractApiError } from '@utils/apiError';
import type {
	Account,
	LoginRequest,
	LoginResponse,
	RegisterRequest,
	RegisterResponse,
	ForgotPasswordRequest,
	ResetPasswordRequest,
	PasswordResetResponse,
	ActivateAccountResponse,
} from '@/types/accounts';

const authService = {
	/**
	 * Register a new user account.
	 * @throws Error — for validation errors or network failures.
	 */
	register: async (data: RegisterRequest): Promise<RegisterResponse> => {
		try {
			const res = await api.post<RegisterResponse>('/accounts/register/', {
				email: data.email,
				password: data.password,
				confirmPassword: data.confirmPassword,
				role: data.role,
			});
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Registration failed');
		}
	},

	/**
	 * Activate a user account using UID + token from email verification link.
	 * @throws Error — when token is invalid or expired.
	 */
	activateAccount: async (uid: string, token: string): Promise<ActivateAccountResponse> => {
		try {
			const res = await api.get<ActivateAccountResponse>(
				`/accounts/activate/${uid}/${token}/`
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Verification failed');
		}
	},

	/**
	 * Authenticate user using email & password.
	 * Returns tokens + user profile.
	 * @throws Error — for invalid credentials or network issues.
	 */
	login: async (credentials: LoginRequest): Promise<LoginResponse> => {
		try {
			const res = await api.post<LoginResponse>('/accounts/login/', credentials);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Login failed');
		}
	},

	/**
	 * Logout user session server-side.
	 * Safe to call even if the token is expired.
	 */
	logout: async () => {
		try {
			await api.post('/accounts/logout/');
		} catch (error) {
			if (import.meta.env.DEV) console.error('Logout error:', error);
		}
	},

	/**
	 * Attempt to refresh the access token using the refresh cookie.
	 * NOTE: The Axios API client automatically handles refreshing when 401 occurs.
	 *
	 * @returns string | null — new access token or null if refresh failed.
	 */
	refreshToken: async (): Promise<string | null> => {
		try {
			const res = await api.post<{ access: string }>(
				'/accounts/token/refresh/'
			);
			return res.data.access;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 401) return null;
			throw axiosError;
		}
	},

	/**
	 * Fetch the currently authenticated user profile.
	 * @throws Error — when the user is not authenticated.
	 */
	getCurrentUser: async (): Promise<Account> => {
		try {
			const res = await api.get<Account>('/accounts/me/');
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to fetch user data');
		}
	},

	/**
	 * Send password reset email to user.
	 * @throws Error — for invalid emails or server errors.
	 */
	requestPasswordReset: async (data: ForgotPasswordRequest): Promise<PasswordResetResponse> => {
		try {
			const res = await api.post<PasswordResetResponse>('/accounts/password-reset/', data);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to send reset email');
		}
	},

	/**
	 * Confirm password reset using uid + token from email link.
	 * @throws Error — when token is expired or passwords are invalid.
	 */
	confirmPasswordReset: async (
		uid: string,
		token: string,
		data: ResetPasswordRequest
	): Promise<PasswordResetResponse> => {
		try {
			const res = await api.post<PasswordResetResponse>(
				`/accounts/password-reset/confirm/${uid}/${token}/`,
				data
			);
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to reset password. The link may have expired.');
		}
	},
};

export default authService;
