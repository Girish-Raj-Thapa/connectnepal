import * as yup from 'yup';

export const profileSchema = yup.object({
	firstName: yup.string().trim().required('First name is required'),
	lastName: yup.string().trim().required('Last name is required'),
	middleName: yup.string().trim().default(''),
	phone: yup.string().trim().required('Phone number is required'),
	dateOfBirth: yup.string().trim().default(''),
	gender: yup.string().trim().default(''),
	address: yup.string().trim().default(''),
});

export type ProfileFormData = yup.InferType<typeof profileSchema>;

export const changePasswordSchema = yup.object({
	currentPassword: yup.string().required('Current password is required'),
	newPassword: yup
		.string()
		.required('New password is required')
		.min(8, 'Password must be at least 8 characters'),
	confirmPassword: yup
		.string()
		.required('Confirm password is required')
		.oneOf([yup.ref('newPassword')], 'Passwords must match'),
});

export type ChangePasswordFormData = yup.InferType<typeof changePasswordSchema>;

export const hostBusinessProfileSchema = yup.object({
	businessName: yup.string().trim().required('Business name is required'),
	businessAddress: yup.string().trim().required('Business address is required'),
	businessPhone: yup.string().trim().default(''),
	aboutService: yup.string().trim().default(''),
});

export type HostBusinessProfileFormData = yup.InferType<typeof hostBusinessProfileSchema>;
