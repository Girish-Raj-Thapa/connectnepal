import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TravellerPreferences from '@pages/traveller/onboarding/TravellerPreferences';
import { ROUTES } from '@/constants/routes';

const onboardingServiceMock = vi.hoisted(() => ({
	submitTravellerPreferences: vi.fn<(data: Record<string, unknown>) => Promise<unknown>>(),
}));

const notificationMock = vi.hoisted(() => ({
	success: vi.fn<(message: string) => void>(),
	error: vi.fn<(message: string) => void>(),
	info: vi.fn<(message: string) => void>(),
}));

vi.mock('@services/onboarding.service', () => ({
	default: onboardingServiceMock,
}));

vi.mock('@utils/notifications', () => ({
	default: notificationMock,
}));

const renderTravellerPreferencesPage = () =>
	render(
		<MemoryRouter initialEntries={[ROUTES.TRAVELLER_ONBOARDING_PREFERENCES]}>
			<Routes>
				<Route
					path={ROUTES.TRAVELLER_ONBOARDING_PREFERENCES}
					element={<TravellerPreferences />}
				/>
				<Route
					path={ROUTES.TRAVELLER_ONBOARDING_COMPLETE}
					element={<div>traveller onboarding complete page</div>}
				/>
			</Routes>
		</MemoryRouter>,
	);

describe('TravellerPreferences page', () => {
	beforeEach(() => {
		onboardingServiceMock.submitTravellerPreferences.mockReset();
		notificationMock.success.mockReset();
		notificationMock.error.mockReset();
		notificationMock.info.mockReset();
		onboardingServiceMock.submitTravellerPreferences.mockResolvedValue({});
	});

	it('shows budget validation errors for an invalid range', async () => {
		const user = userEvent.setup();
		renderTravellerPreferencesPage();

		await user.type(screen.getByLabelText(/minimum budget/i), '10000');
		await user.type(screen.getByLabelText(/maximum budget/i), '5000');
		await user.click(screen.getByRole('button', { name: 'Finish' }));

		expect(await screen.findByText('Max budget must be ≥ min budget')).toBeInTheDocument();
		expect(onboardingServiceMock.submitTravellerPreferences).not.toHaveBeenCalled();
	});

	it('formats preferences for the API and navigates to completion', async () => {
		const user = userEvent.setup();
		renderTravellerPreferencesPage();

		await user.type(screen.getByLabelText(/emergency contact/i), 'Hari - 9800000000');
		await user.click(screen.getByRole('button', { name: 'Hiking' }));
		await user.click(screen.getByRole('button', { name: 'Photography' }));
		await user.type(screen.getByLabelText(/minimum budget/i), '5000');
		await user.type(screen.getByLabelText(/maximum budget/i), '15000');
		await user.click(screen.getByRole('button', { name: 'Luxury' }));
		await user.click(screen.getByRole('button', { name: 'Finish' }));

		await waitFor(() => {
			expect(onboardingServiceMock.submitTravellerPreferences).toHaveBeenCalledWith({
				preferredActivities: ['Hiking', 'Photography'],
				preferredMinBudget: '5000.00',
				preferredMaxBudget: '15000.00',
				preferredTripStyle: 'luxury',
				emergencyContact: 'Hari - 9800000000',
			});
		});

		expect(notificationMock.success).toHaveBeenCalledWith('Preferences saved!');
		expect(await screen.findByText('traveller onboarding complete page')).toBeInTheDocument();
	});

	it('submits an empty payload when skipping preferences', async () => {
		const user = userEvent.setup();
		renderTravellerPreferencesPage();

		await user.click(screen.getByRole('button', { name: 'Skip for now' }));

		await waitFor(() => {
			expect(onboardingServiceMock.submitTravellerPreferences).toHaveBeenCalledWith({});
		});

		expect(notificationMock.info).toHaveBeenCalledWith(
			'Preferences skipped. You can update them later.',
		);
		expect(await screen.findByText('traveller onboarding complete page')).toBeInTheDocument();
	});
});
