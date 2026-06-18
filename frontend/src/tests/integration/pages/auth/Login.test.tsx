import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from '@pages/auth/Login';
import { ROUTES } from '@/constants/routes';
import type { LoginResponse } from '@/types/accounts';

type AuthContextMockValue = {
	user: LoginResponse['user'] | null;
	accessToken: string | null;
	loading: boolean;
	isAuthenticated: boolean;
	login: (credentials: { email: string; password: string }) => Promise<LoginResponse>;
	logout: () => Promise<void>;
	updateUser: (user: LoginResponse['user']) => void;
};

const useAuthMock = vi.hoisted(() => vi.fn<() => AuthContextMockValue>());

vi.mock('@context/AuthContext', () => ({
	useAuth: useAuthMock,
}));

const renderLoginPage = () =>
	render(
		<MemoryRouter initialEntries={[ROUTES.LOGIN]}>
			<Routes>
				<Route path={ROUTES.LOGIN} element={<Login />} />
				<Route path={ROUTES.FORGOT_PASSWORD} element={<div>forgot page</div>} />
				<Route path={ROUTES.REGISTER} element={<div>register page</div>} />
			</Routes>
		</MemoryRouter>,
	);

const createDeferred = <T,>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;

	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
};

describe('Login page', () => {
	beforeEach(() => {
		useAuthMock.mockReset();
		useAuthMock.mockReturnValue({
			user: null,
			accessToken: null,
			loading: false,
			isAuthenticated: false,
			login: vi.fn(),
			logout: vi.fn(async () => {}),
			updateUser: vi.fn(),
		});
	});

	it('shows validation errors when the form is submitted empty', async () => {
		const user = userEvent.setup();
		renderLoginPage();

		await user.click(screen.getByRole('button', { name: 'Sign In' }));

		expect(await screen.findByText('Email is required')).toBeInTheDocument();
		expect(screen.getByText('Password is required')).toBeInTheDocument();
		expect(useAuthMock().login).not.toHaveBeenCalled();
	});

	it('submits normalized credentials and shows a loading state while pending', async () => {
		const deferred = createDeferred<LoginResponse>();
		const loginMock = vi.fn(() => deferred.promise);
		const user = userEvent.setup();

		useAuthMock.mockReturnValue({
			user: null,
			accessToken: null,
			loading: false,
			isAuthenticated: false,
			login: loginMock,
			logout: vi.fn(async () => {}),
			updateUser: vi.fn(),
		});

		renderLoginPage();

		await user.type(screen.getByLabelText(/email address/i), '  USER@Example.COM ');
		await user.type(screen.getByLabelText(/^password/i), 'Password1');
		await user.click(screen.getByRole('button', { name: 'Sign In' }));

		const submitButton = screen.getByRole('button', { name: /loading/i });

		await waitFor(() => {
			expect(submitButton).toBeDisabled();
			expect(submitButton).toHaveTextContent('Loading...');
		});

		expect(loginMock).toHaveBeenCalledWith({
			email: 'user@example.com',
			password: 'Password1',
		});

		deferred.resolve({
			access: 'token',
			user: {
				userId: 1,
				email: 'user@example.com',
				role: 'traveller',
				hasCompletedOnboarding: true,
				onboardingStep: 2,
			},
		});

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
		});
	});

	it('shows the API error banner when login fails', async () => {
		const loginMock = vi.fn(() => Promise.reject(new Error('Invalid credentials')));
		const user = userEvent.setup();

		useAuthMock.mockReturnValue({
			user: null,
			accessToken: null,
			loading: false,
			isAuthenticated: false,
			login: loginMock,
			logout: vi.fn(async () => {}),
			updateUser: vi.fn(),
		});

		renderLoginPage();

		await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
		await user.type(screen.getByLabelText(/^password/i), 'Password1');
		await user.click(screen.getByRole('button', { name: 'Sign In' }));

		expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
	});
});
