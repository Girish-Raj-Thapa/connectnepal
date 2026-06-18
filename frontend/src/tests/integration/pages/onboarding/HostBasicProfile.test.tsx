import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HostBasicProfile from '@pages/host/onboarding/HostBasicProfile';
import { ROUTES } from '@/constants/routes';
import type { Account } from '@/types/accounts';

type AuthContextMockValue = {
	user: Account | null;
	accessToken: string | null;
	loading: boolean;
	isAuthenticated: boolean;
	login: (credentials: { email: string; password: string }) => Promise<unknown>;
	logout: () => Promise<void>;
	updateUser: (user: Account) => void;
};

const useAuthMock = vi.hoisted(() => vi.fn<() => AuthContextMockValue>());

const onboardingServiceMock = vi.hoisted(() => ({
	submitHostBasicProfile: vi.fn<(data: Record<string, unknown>) => Promise<unknown>>(),
}));

const authServiceMock = vi.hoisted(() => ({
	getCurrentUser: vi.fn<() => Promise<Account>>(),
}));

const notificationMock = vi.hoisted(() => ({
	success: vi.fn<(message: string) => void>(),
	error: vi.fn<(message: string) => void>(),
}));

vi.mock('@context/AuthContext', () => ({
	useAuth: useAuthMock,
}));

vi.mock('@services/onboarding.service', () => ({
	default: onboardingServiceMock,
}));

vi.mock('@services/auth.service', () => ({
	default: authServiceMock,
}));

vi.mock('@utils/notifications', () => ({
	default: notificationMock,
}));

const baseUser: Account = {
	userId: 2,
	email: 'host@example.com',
	role: 'host',
	firstName: '',
	lastName: '',
	phone: '',
	address: '',
	hasCompletedOnboarding: false,
	onboardingStep: 0,
};

const renderHostBasicProfilePage = () =>
	render(
		<MemoryRouter initialEntries={[ROUTES.HOST_ONBOARDING_BASIC]}>
			<Routes>
				<Route
					path={ROUTES.HOST_ONBOARDING_BASIC}
					element={<HostBasicProfile />}
				/>
				<Route
					path={ROUTES.HOST_ONBOARDING_BUSINESS}
					element={<div>host business page</div>}
				/>
			</Routes>
		</MemoryRouter>,
	);

describe('HostBasicProfile page', () => {
	beforeEach(() => {
		useAuthMock.mockReset();
		onboardingServiceMock.submitHostBasicProfile.mockReset();
		authServiceMock.getCurrentUser.mockReset();
		notificationMock.success.mockReset();
		notificationMock.error.mockReset();

		useAuthMock.mockReturnValue({
			user: baseUser,
			accessToken: 'token',
			loading: false,
			isAuthenticated: true,
			login: vi.fn(),
			logout: vi.fn(async () => {}),
			updateUser: vi.fn(),
		});

		onboardingServiceMock.submitHostBasicProfile.mockResolvedValue({});
		authServiceMock.getCurrentUser.mockResolvedValue({
			...baseUser,
			firstName: 'Ram',
			lastName: 'Gurung',
			onboardingStep: 1,
		});
	});

	it('shows validation errors when required fields are missing', async () => {
		const user = userEvent.setup();
		renderHostBasicProfilePage();

		await user.click(screen.getByRole('button', { name: 'Continue' }));

		expect(await screen.findByText('First name is required')).toBeInTheDocument();
		expect(screen.getByText('Last name is required')).toBeInTheDocument();
		expect(screen.getByText('Phone number is required')).toBeInTheDocument();
	});

	it('submits the host profile, refreshes the user, and navigates forward', async () => {
		const updateUserMock = vi.fn<(user: Account) => void>();
		const user = userEvent.setup();

		useAuthMock.mockReturnValue({
			user: baseUser,
			accessToken: 'token',
			loading: false,
			isAuthenticated: true,
			login: vi.fn(),
			logout: vi.fn(async () => {}),
			updateUser: updateUserMock,
		});

		renderHostBasicProfilePage();

		await user.type(screen.getByLabelText(/first name/i), 'Ram');
		await user.type(screen.getByLabelText(/last name/i), 'Gurung');
		await user.type(screen.getByLabelText(/phone/i), '+9779800000000');
		await user.type(
			screen.getByLabelText(/address/i, { selector: 'input[name="address"]' }),
			'Pokhara, Kaski',
		);
		await user.click(screen.getByRole('button', { name: 'Continue' }));

		await waitFor(() => {
			expect(onboardingServiceMock.submitHostBasicProfile).toHaveBeenCalledWith({
				firstName: 'Ram',
				lastName: 'Gurung',
				phone: '+9779800000000',
				address: 'Pokhara, Kaski',
				profilePhoto: undefined,
				country: '',
				city: '',
			});
		});

		expect(authServiceMock.getCurrentUser).toHaveBeenCalledTimes(1);
		expect(updateUserMock).toHaveBeenCalledWith({
			...baseUser,
			firstName: 'Ram',
			lastName: 'Gurung',
			onboardingStep: 1,
		});
		expect(notificationMock.success).toHaveBeenCalledWith('Profile saved successfully!');
		expect(await screen.findByText('host business page')).toBeInTheDocument();
	});
});
