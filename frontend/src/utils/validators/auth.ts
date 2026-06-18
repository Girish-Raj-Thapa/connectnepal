import * as yup from 'yup';
import { USER_ROLES } from '@constants/roles';

/**
 * Login Form Validation Schema
 */
export const loginSchema = yup
	.object({
		email: yup
			.string()
			.required('Email is required')
			.email('Please enter a valid email address')
			.lowercase()
			.trim(),
		password: yup.string().required('Password is required'),
	})
	.required();

/**
 * Registration Form Validation Schema
 */
export const registerSchema = yup
	.object({
		email: yup
			.string()
			.required('Email is required')
			.email('Please enter a valid email address')
			.lowercase()
			.trim(),
		password: yup
			.string()
			.required('Password is required')
			.min(8, 'Password must be at least 8 characters')
			.matches(
				/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
				'Password must contain at least one uppercase letter, one lowercase letter, and one number',
			),
		confirmPassword: yup
			.string()
			.required('Please confirm your password')
			.oneOf([yup.ref('password')], 'Passwords must match'),
		role: yup
			.string()
			.required('Please select a role')
			.oneOf([USER_ROLES.TRAVELLER, USER_ROLES.HOST], 'Invalid role selected'),
	})
	.required();

/**
 * Forgot Password Form Validation Schema
 */
export const forgotPasswordSchema = yup
	.object({
		email: yup
			.string()
			.required('Email is required')
			.email('Please enter a valid email address')
			.lowercase()
			.trim(),
	})
	.required();

/**
 * Reset Password Form Validation Schema
 */
export const resetPasswordSchema = yup
	.object({
		newPassword: yup
			.string()
			.required('New password is required')
			.min(8, 'Password must be at least 8 characters')
			.matches(
				/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
				'Password must contain at least one uppercase letter, one lowercase letter, and one number',
			),
		confirmPassword: yup
			.string()
			.required('Please confirm your password')
			.oneOf([yup.ref('newPassword')], 'Passwords must match'),
	})
	.required();

/**
 * Form Types (inferred from Yup schemas)
 * These types are for FORM validation only.
 */
export type LoginFormData = yup.InferType<typeof loginSchema>;
export type RegisterFormData = yup.InferType<typeof registerSchema>;
export type ForgotPasswordFormData = yup.InferType<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = yup.InferType<typeof resetPasswordSchema>;
