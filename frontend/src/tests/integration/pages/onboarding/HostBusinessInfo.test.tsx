import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HostBusinessInfo from '@pages/host/onboarding/HostBusinessInfo';
import { ROUTES } from '@/constants/routes';

const onboardingServiceMock = vi.hoisted(() => ({
	submitHostBusinessInfo: vi.fn<(data: Record<string, unknown>) => Promise<unknown>>(),
}));

const notificationMock = vi.hoisted(() => ({
	success: vi.fn<(message: string) => void>(),
	error: vi.fn<(message: string) => void>(),
}));

vi.mock('@services/onboarding.service', () => ({
	default: onboardingServiceMock,
}));

vi.mock('@utils/notifications', () => ({
	default: notificationMock,
}));

const renderHostBusinessInfoPage = () =>
	render(
		<MemoryRouter initialEntries={[ROUTES.HOST_ONBOARDING_BUSINESS]}>
			<Routes>
				<Route
					path={ROUTES.HOST_ONBOARDING_BUSINESS}
					element={<HostBusinessInfo />}
				/>
				<Route
					path={ROUTES.HOST_ONBOARDING_DOCUMENTS}
					element={<div>host documents page</div>}
				/>
			</Routes>
		</MemoryRouter>,
	);

describe('HostBusinessInfo page', () => {
	beforeEach(() => {
		onboardingServiceMock.submitHostBusinessInfo.mockReset();
		notificationMock.success.mockReset();
		notificationMock.error.mockReset();
		onboardingServiceMock.submitHostBusinessInfo.mockResolvedValue({});
	});

	it('shows validation errors for required business fields', async () => {
		renderHostBusinessInfoPage();

		fireEvent.submit(screen.getByRole('button', { name: 'Continue' }).closest('form')!);

		expect(await screen.findByText('Business name is required')).toBeInTheDocument();
		expect(screen.getByText('Business address is required')).toBeInTheDocument();
	});

	it('submits business info and navigates to document upload', async () => {
		const user = userEvent.setup();
		renderHostBusinessInfoPage();

		await user.type(screen.getByLabelText(/business name/i), 'Himalayan Adventures');
		await user.type(screen.getByLabelText(/business address/i), 'Pokhara Lakeside');
		await user.type(
			screen.getByLabelText(/about your service/i),
			'Guided trekking and curated cultural experiences.',
		);
		await user.click(screen.getByRole('button', { name: 'Continue' }));

		await waitFor(() => {
			expect(onboardingServiceMock.submitHostBusinessInfo).toHaveBeenCalledWith({
				businessName: 'Himalayan Adventures',
				businessAddress: 'Pokhara Lakeside',
				businessPhone: undefined,
				aboutService: 'Guided trekking and curated cultural experiences.',
			});
		});

		expect(notificationMock.success).toHaveBeenCalledWith('Business info saved!');
		expect(await screen.findByText('host documents page')).toBeInTheDocument();
	});
});
