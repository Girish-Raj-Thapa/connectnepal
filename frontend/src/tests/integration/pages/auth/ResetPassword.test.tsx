import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPassword from '@pages/auth/ResetPassword';
import { ROUTES } from '@/constants/routes';

const authServiceMock = vi.hoisted(() => ({
	confirmPasswordReset: vi.fn<
		(uid: string, token: string, data: { newPassword: string; confirmPassword: string }) => Promise<{ message: string }>
	>(),
}));

const notificationMock = vi.hoisted(() => ({
	success: vi.fn<(message: string) => void>(),
}));

vi.mock('@services/auth.service', () => ({
	default: authServiceMock,
}));

vi.mock('@utils/notifications', () => ({
	default: notificationMock,
}));

const renderResetPasswordPage = (path = `${ROUTES.RESET_PASSWORD}?uid=abc&token=xyz`) =>
	render(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route path={ROUTES.RESET_PASSWORD} element={<ResetPassword />} />
				<Route path={ROUTES.LOGIN} element={<div>login page</div>} />
				<Route path={ROUTES.FORGOT_PASSWORD} element={<div>forgot password page</div>} />
			</Routes>
		</MemoryRouter>,
	);

describe('ResetPassword page', () => {
	beforeEach(() => {
		authServiceMock.confirmPasswordReset.mockReset();
		notificationMock.success.mockReset();
		authServiceMock.confirmPasswordReset.mockResolvedValue({ message: 'ok' });
	});

	it('renders the invalid reset link state when uid or token is missing', () => {
		renderResetPasswordPage(ROUTES.RESET_PASSWORD);

		expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
		expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
	});

	it('shows validation errors and does not submit mismatched passwords', async () => {
		const user = userEvent.setup();
		renderResetPasswordPage();

		await user.type(
			screen.getByLabelText(/new password/i, { selector: 'input[name="newPassword"]' }),
			'Password1',
		);
		await user.type(
			screen.getByLabelText(/confirm new password/i, {
				selector: 'input[name="confirmPassword"]',
			}),
			'Password2',
		);
		await user.click(screen.getByRole('button', { name: 'Reset Password' }));

		expect(await screen.findByText('Passwords must match')).toBeInTheDocument();
		expect(authServiceMock.confirmPasswordReset).not.toHaveBeenCalled();
	});

	it('submits successfully and navigates back to login', async () => {
		const user = userEvent.setup();
		renderResetPasswordPage();

		await user.type(
			screen.getByLabelText(/new password/i, { selector: 'input[name="newPassword"]' }),
			'NewPassword1',
		);
		await user.type(
			screen.getByLabelText(/confirm new password/i, {
				selector: 'input[name="confirmPassword"]',
			}),
			'NewPassword1',
		);
		await user.click(screen.getByRole('button', { name: 'Reset Password' }));

		await waitFor(() => {
			expect(authServiceMock.confirmPasswordReset).toHaveBeenCalledWith('abc', 'xyz', {
				newPassword: 'NewPassword1',
				confirmPassword: 'NewPassword1',
			});
		});

		expect(notificationMock.success).toHaveBeenCalledWith('Password reset successful!');
		expect(await screen.findByText('login page')).toBeInTheDocument();
	});
});
