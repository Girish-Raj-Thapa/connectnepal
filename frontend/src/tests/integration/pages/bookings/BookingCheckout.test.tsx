import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BookingCheckout from '@pages/traveller/bookings/BookingCheckout';
import { ROUTES } from '@/constants/routes';
import type { Booking, BookingQuote } from '@/types/bookings';
import type { ListingDetail } from '@/types/listings';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const publicListingsServiceMock = vi.hoisted(() => ({
	getPublicListingBySlug: vi.fn(),
	getPublicSlots: vi.fn(),
}));

const travellerBookingServiceMock = vi.hoisted(() => ({
	quote: vi.fn(),
	create: vi.fn(),
}));

const notificationMock = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
}));

vi.mock('@services/publicListings.service', () => ({
	default: publicListingsServiceMock,
}));

vi.mock('@services/bookings.service', () => ({
	TravellerBookingService: travellerBookingServiceMock,
}));

vi.mock('@utils/notifications', () => ({
	default: notificationMock,
}));

vi.mock('@components/layout/Navbar', () => ({
	default: () => <div>navbar</div>,
}));

vi.mock('@components/bookings/BookingSummaryCard', () => ({
	default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@components/bookings/AvailabilityCalendar', () => ({
	default: ({ onChange }: { onChange: (date: string) => void }) => (
		<button type="button" onClick={() => onChange('2026-05-01')}>
			Select test date
		</button>
	),
}));

const renderBookingCheckout = () =>
	render(
		<MemoryRouter initialEntries={['/listings/everest-flight/book']}>
			<Routes>
				<Route path={ROUTES.LISTING_BOOKING_CHECKOUT} element={<BookingCheckout />} />
				<Route
					path={ROUTES.TRAVELLER_BOOKING_DETAIL}
					element={<div>booking detail page</div>}
				/>
			</Routes>
		</MemoryRouter>,
	);

const buildListing = (overrides: Partial<ListingDetail> = {}): ListingDetail => ({
	id: 12,
	slug: 'everest-flight',
	host: {
		userId: 9,
		businessName: 'Sky Tours',
		fullName: 'Sky Tours',
		profilePhotoUrl: null,
		isVerified: true,
		verificationStatus: 'verified',
		hostSince: '2024-01-01T00:00:00Z',
	},
	images: [
		{
			id: 1,
			imageUrl: 'https://example.com/full.jpg',
			thumbnailUrl: 'https://example.com/thumb.jpg',
			isPrimary: true,
			caption: 'Everest',
			altText: 'Everest',
			order: 1,
			uploadedAt: '2024-01-01T00:00:00Z',
		},
	],
	title: 'Everest Flight',
	description: 'Scenic mountain flight',
	destination: 'Kathmandu',
	location: 'Kathmandu Airport',
	category: 'adventure',
	categoryDisplay: 'Adventure',
	activityType: 'mountain_flight',
	activityTypeDisplay: 'Mountain Flight',
	difficultyLevel: 'easy',
	difficultyLevelDisplay: 'Easy',
	idealFor: ['groups'],
	pricePerPerson: '1500',
	durationDays: 1,
	durationNights: 0,
	durationType: 'full_day',
	averageDurationHours: '4',
	durationDisplay: '1 day',
	totalHours: 4,
	tags: ['scenic'],
	ratingAverage: '4.8',
	ratingCount: 12,
	bestSeasons: ['spring'],
	bestSeasonsDisplay: ['Spring'],
	isBookable: true,
	isActive: true,
	maxGroupSize: 6,
	minGroupSize: 2,
	whatToBring: 'Camera',
	requirements: 'Passport',
	inclusions: ['Guide'],
	exclusions: ['Meals'],
	cancellationPolicy: 'flexible',
	cancellationPolicyDisplay: 'Free cancellation up to 24 hours before',
	languagesOffered: ['English'],
	instantBooking: true,
	hostName: 'Sky Tours',
	createdAt: '2024-01-01T00:00:00Z',
	updatedAt: '2024-01-01T00:00:00Z',
	...overrides,
});

const buildQuote = (overrides: Partial<BookingQuote> = {}): BookingQuote => ({
	items: [
		{
			listingId: 12,
			listingTitle: 'Everest Flight',
			durationType: 'full_day',
			startDate: '2026-05-01',
			endDate: null,
			days: 1,
			travellerCount: 2,
			pricePerPerson: '1500',
			subtotal: '3000',
			feeAmount: '0',
			taxAmount: '0',
			discountAmount: '0',
			grossAmount: '3000',
			quotedTotal: '3000',
			availability: 'available',
			currency: 'NPR',
		},
	],
	totals: {
		subtotal: '3000',
		feeAmount: '0',
		taxAmount: '0',
		discountAmount: '0',
		grossAmount: '3000',
		quotedTotal: '3000',
		currency: 'NPR',
	},
	...overrides,
});

const buildBooking = (overrides: Partial<Booking> = {}): Booking => ({
	id: 77,
	reference: 'BK-77',
	status: 'pending_payment',
	quotedTotal: '3000',
	currency: 'NPR',
	source: 'direct',
	createdAt: '2026-05-01T10:00:00Z',
	items: [],
	...overrides,
});

describe('Booking checkout page', () => {
	beforeEach(() => {
		publicListingsServiceMock.getPublicListingBySlug.mockReset();
		publicListingsServiceMock.getPublicSlots.mockReset();
		travellerBookingServiceMock.quote.mockReset();
		travellerBookingServiceMock.create.mockReset();
		notificationMock.success.mockReset();
		notificationMock.error.mockReset();
		notificationMock.info.mockReset();
	});

	it('shows a retry state when the listing fails to load', async () => {
		const listing = buildListing();
		publicListingsServiceMock.getPublicListingBySlug
			.mockRejectedValueOnce(new Error('Failed to load listing'))
			.mockResolvedValueOnce(listing);

		const user = userEvent.setup();
		renderBookingCheckout();

		expect(await screen.findByText('Failed to load listing')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Retry' }));

		expect(await screen.findByRole('heading', { name: 'Complete Your Booking' })).toBeInTheDocument();
		expect(publicListingsServiceMock.getPublicListingBySlug).toHaveBeenCalledTimes(2);
	});

	it('shows an unavailable message when the listing is not bookable', async () => {
		publicListingsServiceMock.getPublicListingBySlug.mockResolvedValueOnce(
			buildListing({ isBookable: false }),
		);

		renderBookingCheckout();

		expect(
			await screen.findByText('This experience is not currently available for booking.'),
		).toBeInTheDocument();
	});

	it('creates a booking and navigates to the booking detail page after a successful quote', async () => {
		publicListingsServiceMock.getPublicListingBySlug.mockResolvedValueOnce(buildListing());
		publicListingsServiceMock.getPublicSlots.mockResolvedValueOnce([
			{
				id: 401,
				startDate: '2026-05-01',
				endDate: null,
				startTime: null,
				endTime: null,
				capacity: 10,
				availableCapacity: 8,
			},
		]);
		travellerBookingServiceMock.quote.mockResolvedValueOnce(buildQuote());
		travellerBookingServiceMock.create.mockResolvedValueOnce(buildBooking());

		const user = userEvent.setup();
		renderBookingCheckout();

		expect(await screen.findByRole('heading', { name: 'Complete Your Booking' })).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Select test date' }));

		expect(await screen.findByText('Available')).toBeInTheDocument();
		await waitFor(() => {
			expect(screen.getAllByText('NPR 3,000')).toHaveLength(2);
		});

		await user.click(screen.getByRole('button', { name: 'Confirm Booking' }));

		await waitFor(() => {
			expect(screen.getByText('booking detail page')).toBeInTheDocument();
		});

		expect(publicListingsServiceMock.getPublicSlots).toHaveBeenCalledWith(12, '2026-05-01');
		expect(travellerBookingServiceMock.quote).toHaveBeenCalledWith({
			items: [{ listingId: 12, slotId: 401, travellerCount: 2 }],
		});
		expect(travellerBookingServiceMock.create).toHaveBeenCalledWith(
			{
				items: [{ listingId: 12, slotId: 401, travellerCount: 2 }],
			},
			expect.any(String),
		);
		expect(notificationMock.success).toHaveBeenCalledWith(
			'Booking created! Complete payment to confirm.',
		);
	});
});
