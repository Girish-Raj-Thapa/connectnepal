import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentFailure from '@pages/payment/PaymentFailure';
import { ROUTES } from '@/constants/routes';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const travellerBookingServiceMock = vi.hoisted(() => ({
	getDetail: vi.fn(),
}));

vi.mock('@services/bookings.service', () => ({
	TravellerBookingService: travellerBookingServiceMock,
}));

vi.mock('@components/layout/Navbar', () => ({
	default: () => <div>navbar</div>,
}));

const renderPaymentFailure = (
	entry = '/payment/failure?booking_id=42&attempt_id=99&reason=verification_pending',
) =>
	render(
		<MemoryRouter initialEntries={[entry]}>
			<Routes>
				<Route path={ROUTES.PAYMENT_FAILURE} element={<PaymentFailure />} />
				<Route path={ROUTES.PAYMENT_PROCESSING} element={<div>processing page</div>} />
				<Route path={ROUTES.TRAVELLER_BOOKINGS} element={<div>bookings page</div>} />
				<Route
					path={ROUTES.TRAVELLER_BOOKING_DETAIL}
					element={<div>booking detail page</div>}
				/>
				<Route path={ROUTES.HOME} element={<div>home page</div>} />
			</Routes>
		</MemoryRouter>,
	);

describe('Payment failure page', () => {
	beforeEach(() => {
		travellerBookingServiceMock.getDetail.mockReset();
	});

	it('shows the verification-pending helper link and keeps the booking action when payment is still pending', async () => {
		travellerBookingServiceMock.getDetail.mockResolvedValueOnce({
			status: 'pending_payment',
		});

		const user = userEvent.setup();
		renderPaymentFailure();

		expect(await screen.findByText('Pending Payment')).toBeInTheDocument();
		expect(
			screen.getByText('Your payment is still being verified. Please check your booking status.'),
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Check payment status' })).toHaveAttribute(
			'href',
			'/payment/processing?attempt_id=99',
		);

		await user.click(screen.getByRole('button', { name: 'View Booking' }));

		await waitFor(() => {
			expect(screen.getByText('booking detail page')).toBeInTheDocument();
		});
	});

	it('falls back to the default failure message for unknown reason codes', async () => {
		renderPaymentFailure('/payment/failure?attempt_id=11&reason=not_a_real_reason');

		expect(
			await screen.findByText(
				'We could not complete payment confirmation. Please check your booking status and create a new booking if needed.',
			),
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'View My Bookings' })).toBeInTheDocument();
	});
});
