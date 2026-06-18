import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Register from '@pages/auth/Register';
import { ROUTES } from '@/constants/routes';
import type { RegisterFormData } from '@utils/validators';

type RegisterPayload = RegisterFormData;

const authServiceMock = vi.hoisted(() => ({
	register: vi.fn<(data: RegisterPayload) => Promise<{ message: string }>>(),
}));

const notificationMock = vi.hoisted(() => ({
	success: vi.fn<(message: string) => void>(),
	error: vi.fn<(message: string) => void>(),
}));

vi.mock('@services/auth.service', () => ({
	default: authServiceMock,
}));

vi.mock('@utils/notifications', () => ({
	default: notificationMock,
}));

const EmailConfirmationMarker = () => {
	const location = useLocation();
	const state = location.state as { email?: string } | null;

	return (
		<div>
			<div>email confirmation page</div>
			<div data-testid="state-email">{state?.email ?? 'none'}</div>
		</div>
	);
};

const renderRegisterPage = () =>
	render(
		<MemoryRouter initialEntries={[ROUTES.REGISTER]}>
			<Routes>
				<Route path={ROUTES.REGISTER} element={<Register />} />
				<Route path={ROUTES.LOGIN} element={<div>login page</div>} />
				<Route
					path={ROUTES.EMAIL_CONFIRMATION}
					element={<EmailConfirmationMarker />}
				/>
			</Routes>
		</MemoryRouter>,
	);

describe('Register page', () => {
	beforeEach(() => {
		authServiceMock.register.mockReset();
		notificationMock.success.mockReset();
		notificationMock.error.mockReset();
		authServiceMock.register.mockResolvedValue({ message: 'ok' });
	});

	it('shows validation errors for invalid registration input', async () => {
		const user = userEvent.setup();
		renderRegisterPage();

		await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
		await user.type(screen.getByLabelText(/^password/i), 'Password1');
		await user.type(screen.getByLabelText(/confirm password/i), 'Password2');
		fireEvent.submit(screen.getByRole('button', { name: 'Create Account' }).closest('form')!);

		await waitFor(() => {
			expect(screen.getByText('Passwords must match')).toBeInTheDocument();
		});
		expect(screen.getByText('Passwords must match')).toBeInTheDocument();
		expect(screen.getByText('Please select a role')).toBeInTheDocument();
	});

	it('submits successfully, shows a success toast, and navigates to email confirmation', async () => {
		const user = userEvent.setup();
		renderRegisterPage();

		await user.type(screen.getByLabelText(/email address/i), '  USER@Example.COM ');
		await user.type(screen.getByLabelText(/^password/i), 'Password1');
		await user.type(screen.getByLabelText(/confirm password/i), 'Password1');
		await user.click(screen.getByLabelText('Tourist'));
		await user.click(screen.getByRole('button', { name: 'Create Account' }));

		await waitFor(() => {
			expect(authServiceMock.register).toHaveBeenCalledWith({
				email: 'user@example.com',
				password: 'Password1',
				confirmPassword: 'Password1',
				role: 'traveller',
			});
		});

		expect(notificationMock.success).toHaveBeenCalledWith('Account Created Successfully!');
		expect(await screen.findByText('email confirmation page')).toBeInTheDocument();
		expect(screen.getByTestId('state-email')).toHaveTextContent('user@example.com');
	});

	it('shows the API error banner and failure toast when registration fails', async () => {
		const user = userEvent.setup();
		authServiceMock.register.mockRejectedValueOnce(new Error('Duplicate email'));

		renderRegisterPage();

		await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
		await user.type(screen.getByLabelText(/^password/i), 'Password1');
		await user.type(screen.getByLabelText(/confirm password/i), 'Password1');
		await user.click(screen.getByLabelText('Host'));
		await user.click(screen.getByRole('button', { name: 'Create Account' }));

		expect(await screen.findByText('Duplicate email')).toBeInTheDocument();
		expect(notificationMock.error).toHaveBeenCalledWith('Failed to Create Account');
	});
});
