import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Account, LoginResponse, UserRole } from '@/types/accounts';
import { ROUTES } from '@/constants/routes';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type SetAuthTokenHandlers = (
	getToken: () => string | null,
	refreshHandler: () => Promise<string | null>,
) => void;

const authServiceMock = vi.hoisted(() => ({
	refreshToken: vi.fn(),
	getCurrentUser: vi.fn(),
	login: vi.fn(),
	logout: vi.fn(),
}));

const setAuthTokenHandlersMock = vi.hoisted(() => vi.fn<SetAuthTokenHandlers>());

vi.mock('@services/auth.service', () => ({
	default: authServiceMock,
}));

vi.mock('@services/api.service', () => ({
	setAuthTokenHandlers: setAuthTokenHandlersMock,
}));

import { AuthProvider, useAuth } from '@context/AuthContext';

const buildUser = (
	role: UserRole,
	overrides: Partial<Account> = {},
): Account => ({
	userId: 1,
	email: `${role}@example.com`,
	role,
	hasCompletedOnboarding: true,
	onboardingStep: 2,
	...overrides,
});

const LocationMarker = () => {
	const location = useLocation();
	return <div data-testid="location">{location.pathname}</div>;
};

const AuthStateView = () => {
	const {
		user,
		accessToken,
		loading,
		isLoggingOut,
		isAuthenticated,
		login,
		logout,
	} = useAuth();

	return (
		<div>
			<LocationMarker />
			<div data-testid="loading">{String(loading)}</div>
			<div data-testid="email">{user?.email ?? 'anonymous'}</div>
			<div data-testid="token">{accessToken ?? 'none'}</div>
			<div data-testid="is-authenticated">{String(isAuthenticated)}</div>
			<div data-testid="is-logging-out">{String(isLoggingOut)}</div>
			<button
				type="button"
				onClick={() => {
					void login({
						email: 'user@example.com',
						password: 'Password1',
					});
				}}
			>
				login
			</button>
			<button
				type="button"
				onClick={() => {
					void logout();
				}}
			>
				logout
			</button>
		</div>
	);
};

const renderAuthProvider = () =>
	render(
		<MemoryRouter initialEntries={['/']}>
			<AuthProvider>
				<Routes>
					<Route path="/" element={<AuthStateView />} />
					<Route path={ROUTES.LOGIN} element={<LocationMarker />} />
					<Route path={ROUTES.TRAVELLER_DASHBOARD} element={<AuthStateView />} />
					<Route path={ROUTES.HOST_DASHBOARD} element={<AuthStateView />} />
					<Route path={ROUTES.ADMIN_DASHBOARD} element={<AuthStateView />} />
					<Route
						path={ROUTES.TRAVELLER_ONBOARDING_PREFERENCES}
						element={<LocationMarker />}
					/>
				</Routes>
			</AuthProvider>
		</MemoryRouter>,
	);

describe('AuthContext', () => {
	beforeEach(() => {
		window.sessionStorage.clear();
		authServiceMock.refreshToken.mockReset();
		authServiceMock.getCurrentUser.mockReset();
		authServiceMock.login.mockReset();
		authServiceMock.logout.mockReset();
		setAuthTokenHandlersMock.mockReset();

		authServiceMock.refreshToken.mockResolvedValue(null);
		authServiceMock.logout.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('registers auth token handlers and restores a session on mount', async () => {
		const user = buildUser('traveller');
		authServiceMock.refreshToken.mockResolvedValueOnce('boot-token');
		authServiceMock.getCurrentUser.mockResolvedValueOnce(user);

		renderAuthProvider();

		await waitFor(() => {
			expect(screen.getByTestId('loading')).toHaveTextContent('false');
		});

		expect(screen.getByTestId('email')).toHaveTextContent(user.email);
		expect(screen.getByTestId('token')).toHaveTextContent('boot-token');
		expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
		expect(setAuthTokenHandlersMock).toHaveBeenCalledTimes(1);
		expect(authServiceMock.getCurrentUser).toHaveBeenCalledTimes(1);
	});

	it('finishes boot unauthenticated when refresh returns null', async () => {
		renderAuthProvider();

		await waitFor(() => {
			expect(screen.getByTestId('loading')).toHaveTextContent('false');
		});

		expect(screen.getByTestId('email')).toHaveTextContent('anonymous');
		expect(screen.getByTestId('token')).toHaveTextContent('none');
		expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
		expect(authServiceMock.getCurrentUser).not.toHaveBeenCalled();
	});

	it('logs in and navigates to the correct post-login route', async () => {
		const loginResponse: LoginResponse = {
			access: 'login-token',
			user: buildUser('traveller', {
				hasCompletedOnboarding: false,
				onboardingStep: 1,
			}),
		};
		authServiceMock.login.mockResolvedValueOnce(loginResponse);

		renderAuthProvider();

		await waitFor(() => {
			expect(screen.getByTestId('loading')).toHaveTextContent('false');
		});

		fireEvent.click(screen.getByRole('button', { name: 'login' }));

		await waitFor(() => {
			expect(screen.getByTestId('location')).toHaveTextContent(
				ROUTES.TRAVELLER_ONBOARDING_PREFERENCES,
			);
		});
	});

	it('logs out and clears auth state even if logout request resolves normally', async () => {
		const loginResponse: LoginResponse = {
			access: 'login-token',
			user: buildUser('host'),
		};
		authServiceMock.login.mockResolvedValueOnce(loginResponse);

		renderAuthProvider();

		await waitFor(() => {
			expect(screen.getByTestId('loading')).toHaveTextContent('false');
		});

		fireEvent.click(screen.getByRole('button', { name: 'login' }));

		await waitFor(() => {
			expect(screen.getByTestId('location')).toHaveTextContent(ROUTES.HOST_DASHBOARD);
		});

		fireEvent.click(screen.getByRole('button', { name: 'logout' }));

		await waitFor(() => {
			expect(screen.getByTestId('location')).toHaveTextContent(ROUTES.HOME);
		});
	});

	it('clears session and redirects to home when the captured refresh handler fails', async () => {
		const user = buildUser('host');
		let capturedRefreshHandler: (() => Promise<string | null>) | undefined;

		setAuthTokenHandlersMock.mockImplementation((_, refreshHandler) => {
			capturedRefreshHandler = refreshHandler;
		});

		authServiceMock.refreshToken.mockResolvedValueOnce('boot-token');
		authServiceMock.getCurrentUser.mockResolvedValueOnce(user);

		renderAuthProvider();

		await waitFor(() => {
			expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
		});

		authServiceMock.refreshToken.mockRejectedValueOnce(new Error('refresh failed'));

		await expect(capturedRefreshHandler?.()).rejects.toThrow('refresh failed');

		await waitFor(() => {
			expect(screen.getByTestId('location')).toHaveTextContent(ROUTES.HOME);
		});
	});
});
