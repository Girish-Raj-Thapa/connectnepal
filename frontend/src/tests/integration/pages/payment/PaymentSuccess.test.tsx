import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentSuccess from '@pages/payment/PaymentSuccess';
import { ROUTES } from '@/constants/routes';
import type { Booking } from '@/types/bookings';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const travellerBookingServiceMock = vi.hoisted(() => ({
	getDetail: vi.fn(),
}));

const useSimilarListingsMock = vi.hoisted(() => vi.fn());

vi.mock('@services/bookings.service', () => ({
	TravellerBookingService: travellerBookingServiceMock,
}));

vi.mock('@/hooks/useRecommendations', () => ({
	useSimilarListings: useSimilarListingsMock,
}));

vi.mock('@components/layout/Navbar', () => ({
	default: () => <div>navbar</div>,
}));

vi.mock('@components/listings/RecommendationGrid', () => ({
	default: ({
		title,
		listings,
	}: {
		title: string;
		listings: Array<{ id: number }>;
	}) => (
		<div data-testid="recommendation-grid">
			{title}:{listings.length}
		</div>
	),
}));

const renderPaymentSuccess = (entry = '/payment/success?booking_id=55') =>
	render(
		<MemoryRouter initialEntries={[entry]}>
			<Routes>
				<Route path={ROUTES.PAYMENT_SUCCESS} element={<PaymentSuccess />} />
				<Route path={ROUTES.HOME} element={<div>home page</div>} />
				<Route
					path={ROUTES.TRAVELLER_BOOKING_DETAIL}
					element={<div>booking detail page</div>}
				/>
			</Routes>
		</MemoryRouter>,
	);

const buildBooking = (overrides: Partial<Booking> = {}): Booking => ({
	id: 55,
	reference: 'BK-55',
	status: 'confirmed',
	quotedTotal: '4800',
	currency: 'NPR',
	source: 'direct',
	createdAt: '2026-05-01T10:00:00Z',
	items: [
		{
			id: 1,
			listingId: 12,
			listingTitle: 'Everest Flight',
			durationType: 'full_day',
			startDate: '2026-05-02',
			endDate: null,
			startTime: null,
			endTime: null,
			days: 1,
			nights: 0,
			travellerCount: 2,
			status: 'confirmed',
			quotedTotal: '4800',
			currency: 'NPR',
			reviewId: null,
			hasReview: false,
			reviewStatus: null,
			canReview: false,
			cannotReviewReason: null,
		},
	],
	...overrides,
});

describe('Payment success page', () => {
	beforeEach(() => {
		travellerBookingServiceMock.getDetail.mockReset();
		useSimilarListingsMock.mockReset();
		useSimilarListingsMock.mockReturnValue({
			listings: [{ id: 91 }, { id: 92 }],
			meta: null,
			loading: false,
			error: null,
		});
	});

	it('renders confirmed booking details and links to the booking detail page', async () => {
		travellerBookingServiceMock.getDetail.mockResolvedValueOnce(buildBooking());

		const user = userEvent.setup();
		renderPaymentSuccess();

		expect(await screen.findByRole('heading', { name: 'Payment Successful!' })).toBeInTheDocument();
		expect(screen.getByText('BK-55')).toBeInTheDocument();
		expect(screen.getByText('Everest Flight')).toBeInTheDocument();
		expect(screen.getByTestId('recommendation-grid')).toHaveTextContent(
			'Explore Similar Activities:2',
		);

		await user.click(screen.getByRole('button', { name: 'View Booking Details' }));

		await waitFor(() => {
			expect(screen.getByText('booking detail page')).toBeInTheDocument();
		});
	});

	it('shows fallback confirmation text when booking detail fetch fails', async () => {
		travellerBookingServiceMock.getDetail.mockRejectedValueOnce(
			new Error('Failed to fetch booking details'),
		);

		renderPaymentSuccess();

		expect(
			await screen.findByText(
				'Payment was successful! Your booking details will be available shortly.',
			),
		).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'View Booking Details' }),
		).not.toBeInTheDocument();
	});

	it('redirects to home when the booking id is missing from the query string', async () => {
		renderPaymentSuccess('/payment/success');

		await waitFor(() => {
			expect(screen.getByText('home page')).toBeInTheDocument();
		});
	});
});
