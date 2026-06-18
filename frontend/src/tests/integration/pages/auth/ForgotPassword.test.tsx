import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPassword from '@pages/auth/ForgotPassword';
import { ROUTES } from '@/constants/routes';

const authServiceMock = vi.hoisted(() => ({
	requestPasswordReset: vi.fn<(data: { email: string }) => Promise<{ message: string }>>(),
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

const renderForgotPasswordPage = () =>
	render(
		<MemoryRouter initialEntries={[ROUTES.FORGOT_PASSWORD]}>
			<Routes>
				<Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />
				<Route path={ROUTES.LOGIN} element={<div>login page</div>} />
			</Routes>
		</MemoryRouter>,
	);

describe('ForgotPassword page', () => {
	beforeEach(() => {
		authServiceMock.requestPasswordReset.mockReset();
		notificationMock.success.mockReset();
		authServiceMock.requestPasswordReset.mockResolvedValue({ message: 'ok' });
	});

	it('shows a validation error for an invalid email when the form submit is triggered', async () => {
		const user = userEvent.setup();
		renderForgotPasswordPage();

		await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
		fireEvent.submit(screen.getByRole('button', { name: 'Send Reset Link' }).closest('form')!);

		expect(await screen.findByText('Please enter a valid email address')).toBeInTheDocument();
	});

	it('submits successfully and shows the confirmation result card', async () => {
		const user = userEvent.setup();
		renderForgotPasswordPage();

		await user.type(screen.getByLabelText(/email address/i), '  RESET@Example.com ');
		await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

		await waitFor(() => {
			expect(authServiceMock.requestPasswordReset).toHaveBeenCalledWith({
				email: 'reset@example.com',
			});
		});

		expect(notificationMock.success).toHaveBeenCalledWith('Password reset email sent!');
		expect(await screen.findByText('Check Your Email')).toBeInTheDocument();
		expect(screen.getByText(/reset@example\.com/i)).toBeInTheDocument();
	});

	it('shows the API error banner when reset email request fails', async () => {
		const user = userEvent.setup();
		authServiceMock.requestPasswordReset.mockRejectedValueOnce(new Error('User not found'));

		renderForgotPasswordPage();

		await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
		await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

		expect(await screen.findByText('User not found')).toBeInTheDocument();
	});
});
