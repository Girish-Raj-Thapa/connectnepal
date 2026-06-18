import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BasicProfile from '@pages/traveller/onboarding/BasicProfile';
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
	submitTravellerBasicProfile: vi.fn<(data: Record<string, unknown>) => Promise<unknown>>(),
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
	userId: 1,
	email: 'traveller@example.com',
	role: 'traveller',
	firstName: '',
	lastName: '',
	middleName: '',
	phone: '',
	country: '',
	city: '',
	dateOfBirth: '',
	gender: '',
	address: '',
	hasCompletedOnboarding: false,
	onboardingStep: 0,
	profilePhoto: null,
};

const renderBasicProfilePage = () =>
	render(
		<MemoryRouter initialEntries={[ROUTES.TRAVELLER_ONBOARDING_BASIC]}>
			<Routes>
				<Route
					path={ROUTES.TRAVELLER_ONBOARDING_BASIC}
					element={<BasicProfile />}
				/>
				<Route
					path={ROUTES.TRAVELLER_ONBOARDING_PREFERENCES}
					element={<div>traveller preferences page</div>}
				/>
			</Routes>
		</MemoryRouter>,
	);

describe('Traveller BasicProfile page', () => {
	beforeEach(() => {
		useAuthMock.mockReset();
		onboardingServiceMock.submitTravellerBasicProfile.mockReset();
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

		onboardingServiceMock.submitTravellerBasicProfile.mockResolvedValue({});
		authServiceMock.getCurrentUser.mockResolvedValue({
			...baseUser,
			firstName: 'Sita',
			lastName: 'Shrestha',
			onboardingStep: 1,
		});
	});

	it('shows validation errors for required fields', async () => {
		const user = userEvent.setup();
		renderBasicProfilePage();

		await user.click(screen.getByRole('button', { name: 'Continue' }));

		expect(await screen.findByText('First name is required')).toBeInTheDocument();
		expect(screen.getByText('Last name is required')).toBeInTheDocument();
		expect(screen.getByText('Phone number is required')).toBeInTheDocument();
		expect(screen.getByText('Country is required')).toBeInTheDocument();
		expect(screen.getByText('City is required')).toBeInTheDocument();
	});

	it('submits profile data, refreshes the user, and navigates to preferences', async () => {
		const updateUserMock = vi.fn<(user: Account) => void>();
		const user = userEvent.setup();
		const photoFile = new File(['avatar'], 'avatar.png', { type: 'image/png' });

		useAuthMock.mockReturnValue({
			user: baseUser,
			accessToken: 'token',
			loading: false,
			isAuthenticated: true,
			login: vi.fn(),
			logout: vi.fn(async () => {}),
			updateUser: updateUserMock,
		});

		renderBasicProfilePage();

		const fileInput = document.querySelector<HTMLInputElement>(
			'input[type="file"][accept="image/jpeg,image/png,image/webp"]',
		);

		if (!fileInput) {
			throw new Error('Photo upload input not found');
		}

		await user.upload(fileInput, photoFile);
		await user.type(screen.getByLabelText(/first name/i), 'Sita');
		await user.type(screen.getByLabelText(/last name/i), 'Shrestha');
		await user.type(screen.getByLabelText(/phone/i), '+9779812345678');
		await user.type(screen.getByLabelText(/country/i), 'Nepal');
		await user.type(screen.getByLabelText(/city/i), 'Kathmandu');
		await user.type(
			screen.getByLabelText(/address/i, { selector: 'input[name="address"]' }),
			'Boudha',
		);
		await user.selectOptions(screen.getByLabelText(/gender/i), 'female');
		await user.click(screen.getByRole('button', { name: 'Continue' }));

		await waitFor(() => {
			expect(onboardingServiceMock.submitTravellerBasicProfile).toHaveBeenCalledWith({
				firstName: 'Sita',
				lastName: 'Shrestha',
				middleName: '',
				phone: '+9779812345678',
				country: 'Nepal',
				city: 'Kathmandu',
				dateOfBirth: '',
				gender: 'female',
				address: 'Boudha',
				profilePhoto: photoFile,
			});
		});

		expect(authServiceMock.getCurrentUser).toHaveBeenCalledTimes(1);
		expect(updateUserMock).toHaveBeenCalledWith({
			...baseUser,
			firstName: 'Sita',
			lastName: 'Shrestha',
			onboardingStep: 1,
		});
		expect(notificationMock.success).toHaveBeenCalledWith('Profile saved successfully!');
		expect(await screen.findByText('traveller preferences page')).toBeInTheDocument();
	});
});
