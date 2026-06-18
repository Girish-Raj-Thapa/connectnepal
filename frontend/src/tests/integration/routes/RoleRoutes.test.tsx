import { render, screen } from '@testing-library/react';
import type { Account, UserRole } from '@/types/accounts';
import { ROUTES } from '@/constants/routes';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoleRoutes from '@routes/RoleRoutes';

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

const renderRoleRoutes = (initialPath: string, allowGuests = false) =>
	render(
		<MemoryRouter initialEntries={[initialPath]}>
			<Routes>
				<Route
					element={<RoleRoutes allowedRoles={['traveller']} allowGuests={allowGuests} />}
				>
					<Route path={ROUTES.PUBLIC_LISTINGS} element={<div>role protected page</div>} />
				</Route>
				<Route path={ROUTES.LOGIN} element={<div>login page</div>} />
				<Route path={ROUTES.HOST_DASHBOARD} element={<div>host dashboard</div>} />
			</Routes>
		</MemoryRouter>,
	);

describe('RoleRoutes', () => {
	beforeEach(() => {
		useAuthMock.mockReset();
	});

	it('shows the loader while auth state is loading', () => {
		useAuthMock.mockReturnValue({
			user: null,
			loading: true,
		});

		renderRoleRoutes(ROUTES.PUBLIC_LISTINGS);

		expect(screen.getByText('Loading...')).toBeInTheDocument();
	});

	it('allows guests through when allowGuests is true', () => {
		useAuthMock.mockReturnValue({
			user: null,
			loading: false,
		});

		renderRoleRoutes(ROUTES.PUBLIC_LISTINGS, true);

		expect(screen.getByText('role protected page')).toBeInTheDocument();
	});

	it('redirects guests to login when allowGuests is false', () => {
		useAuthMock.mockReturnValue({
			user: null,
			loading: false,
		});

		renderRoleRoutes(ROUTES.PUBLIC_LISTINGS, false);

		expect(screen.getByText('login page')).toBeInTheDocument();
	});

	it('redirects authenticated users without the right role to their own post-login route', () => {
		useAuthMock.mockReturnValue({
			user: buildUser('host'),
			loading: false,
		});

		renderRoleRoutes(ROUTES.PUBLIC_LISTINGS);

		expect(screen.getByText('host dashboard')).toBeInTheDocument();
	});

	it('renders child routes for authenticated users with an allowed role', () => {
		useAuthMock.mockReturnValue({
			user: buildUser('traveller'),
			loading: false,
		});

		renderRoleRoutes(ROUTES.PUBLIC_LISTINGS);

		expect(screen.getByText('role protected page')).toBeInTheDocument();
	});
});
