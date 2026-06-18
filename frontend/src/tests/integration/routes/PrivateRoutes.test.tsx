import { render, screen } from '@testing-library/react';
import type { Account, UserRole } from '@/types/accounts';
import { ROUTES } from '@/constants/routes';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrivateRoutes from '@routes/PrivateRoutes';

type RouteAuthState = {
	user: Account | null;
	loading: boolean;
};

const useAuthMock = vi.hoisted(() => vi.fn<() => RouteAuthState>());

vi.mock('@context/AuthContext', () => ({
	useAuth: useAuthMock,
}));

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

const renderPrivateRoutes = (initialPath: string) =>
	render(
		<MemoryRouter initialEntries={[initialPath]}>
			<Routes>
				<Route element={<PrivateRoutes />}>
					<Route path={ROUTES.TRAVELLER_DASHBOARD} element={<div>protected page</div>} />
					<Route
						path={ROUTES.TRAVELLER_ONBOARDING_PREFERENCES}
						element={<div>preferences page</div>}
					/>
					<Route
						path={ROUTES.TRAVELLER_ONBOARDING_COMPLETE}
						element={<div>traveller complete page</div>}
					/>
					<Route
						path={ROUTES.HOST_ONBOARDING_DOCUMENTS}
						element={<div>host documents page</div>}
					/>
				</Route>
				<Route path={ROUTES.LOGIN} element={<div>login page</div>} />
			</Routes>
		</MemoryRouter>,
	);

describe('PrivateRoutes', () => {
	beforeEach(() => {
		useAuthMock.mockReset();
	});

	it('shows the loader while auth state is loading', () => {
		useAuthMock.mockReturnValue({
			user: null,
			loading: true,
		});

		renderPrivateRoutes(ROUTES.TRAVELLER_DASHBOARD);

		expect(screen.getByText('Loading...')).toBeInTheDocument();
	});

	it('redirects guests to login', () => {
		useAuthMock.mockReturnValue({
			user: null,
			loading: false,
		});

		renderPrivateRoutes(ROUTES.TRAVELLER_DASHBOARD);

		expect(screen.getByText('login page')).toBeInTheDocument();
	});

	it('redirects incomplete onboarding users to their onboarding route', () => {
		useAuthMock.mockReturnValue({
			user: buildUser('traveller', {
				hasCompletedOnboarding: false,
				onboardingStep: 1,
			}),
			loading: false,
		});

		renderPrivateRoutes(ROUTES.TRAVELLER_DASHBOARD);

		expect(screen.getByText('preferences page')).toBeInTheDocument();
	});

	it('redirects completed users away from onboarding pages that should be blocked', () => {
		useAuthMock.mockReturnValue({
			user: buildUser('traveller'),
			loading: false,
		});

		renderPrivateRoutes(ROUTES.TRAVELLER_ONBOARDING_PREFERENCES);

		expect(screen.getByText('protected page')).toBeInTheDocument();
	});

	it('allows whitelisted onboarding pages after completion', () => {
		useAuthMock.mockReturnValue({
			user: buildUser('host'),
			loading: false,
		});

		renderPrivateRoutes(ROUTES.HOST_ONBOARDING_DOCUMENTS);

		expect(screen.getByText('host documents page')).toBeInTheDocument();
	});

	it('renders protected content for authenticated users on allowed routes', () => {
		useAuthMock.mockReturnValue({
			user: buildUser('traveller'),
			loading: false,
		});

		renderPrivateRoutes(ROUTES.TRAVELLER_DASHBOARD);

		expect(screen.getByText('protected page')).toBeInTheDocument();
	});
});
