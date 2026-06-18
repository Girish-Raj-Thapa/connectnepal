import { describe, expect, it } from 'vitest';
import {
	forgotPasswordSchema,
	loginSchema,
	registerSchema,
	resetPasswordSchema,
} from '@utils/validators/auth';
import { USER_ROLES } from '@constants/roles';

describe('auth validators', () => {
	it('normalizes login email input', async () => {
		const value = await loginSchema.validate({
			email: '  USER@Example.COM ',
			password: 'Secret123',
		});

		expect(value).toEqual({
			email: 'user@example.com',
			password: 'Secret123',
		});
	});

	it('rejects login when required fields are missing', async () => {
		await expect(
			loginSchema.validate({}, { abortEarly: false }),
		).rejects.toThrow('2 errors occurred');
	});

	it('rejects registration for invalid email format', async () => {
		await expect(
			registerSchema.validate({
				email: 'not-an-email',
				password: 'Password1',
				confirmPassword: 'Password1',
				role: USER_ROLES.TRAVELLER,
			}),
		).rejects.toThrow('Please enter a valid email address');
	});

	it('rejects registration when passwords do not match', async () => {
		await expect(
			registerSchema.validate({
				email: 'user@example.com',
				password: 'Password1',
				confirmPassword: 'Password2',
				role: USER_ROLES.HOST,
			}),
		).rejects.toThrow('Passwords must match');
	});

	it('rejects registration when role is invalid', async () => {
		await expect(
			registerSchema.validate({
				email: 'user@example.com',
				password: 'Password1',
				confirmPassword: 'Password1',
				role: 'guest',
			}),
		).rejects.toThrow('Invalid role selected');
	});

	it('accepts a valid forgot-password email and normalizes it', async () => {
		const value = await forgotPasswordSchema.validate({
			email: '  RESET@Example.com ',
		});

		expect(value).toEqual({ email: 'reset@example.com' });
	});

	it('rejects reset password when the password is too weak', async () => {
		await expect(
			resetPasswordSchema.validate({
				newPassword: 'short',
				confirmPassword: 'short',
			}),
		).rejects.toThrow('Password must be at least 8 characters');
	});

	it('accepts a valid reset password payload', async () => {
		const value = await resetPasswordSchema.validate({
			newPassword: 'NewPassword1',
			confirmPassword: 'NewPassword1',
		});

		expect(value).toEqual({
			newPassword: 'NewPassword1',
			confirmPassword: 'NewPassword1',
		});
	});
});
