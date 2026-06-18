import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookFromTrip from '@pages/traveller/bookings/BookFromTrip';
import { ROUTES } from '@/constants/routes';
import type { Booking } from '@/types/bookings';
import type { TripPlanDetail } from '@/types/tripPlanner';

const tripPlannerServiceMock = vi.hoisted(() => ({
	getTripPlan: vi.fn(),
}));

const publicListingsServiceMock = vi.hoisted(() => ({
	getPublicSlots: vi.fn(),
}));

const travellerBookingServiceMock = vi.hoisted(() => ({
	bookFromTripPlan: vi.fn(),
}));

const notificationMock = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
}));

vi.mock('@services/tripPlanner.service', () => ({
	default: tripPlannerServiceMock,
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

vi.mock('@/layouts/DashboardLayout', () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@components/feedback/Loader', () => ({
	default: ({ text }: { text?: string }) => <div>{text ?? 'loading'}</div>,
}));

vi.mock('@components/feedback/FormErrorBanner', () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@components/button/Button', () => ({
	default: ({
		children,
		type = 'button',
		onClick,
		disabled,
	}: {
		children: React.ReactNode;
		type?: 'button' | 'submit';
		onClick?: () => void;
		disabled?: boolean;
	}) => (
		<button type={type} onClick={onClick} disabled={disabled}>
			{children}
		</button>
	),
}));

vi.mock('@components/form/InputField', () => ({
	default: ({
		label,
		name,
		value,
		onChange,
		type = 'text',
		error,
	}: {
		label?: string;
		name?: string;
		value?: string | number;
		onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
		type?: string;
		error?: string;
	}) => (
		<label>
			<span>{label}</span>
			<input
				aria-label={label}
				name={name}
				type={type}
				value={value ?? ''}
				onChange={onChange}
			/>
			{error ? <span>{error}</span> : null}
		</label>
	),
}));

vi.mock('@components/bookings/AvailabilityCalendar', () => ({
	default: ({
		onChange,
		label,
	}: {
		onChange: (date: string) => void;
		label?: string;
	}) => (
		<button type="button" aria-label={label} onClick={() => onChange('2026-05-20')}>
			Select test date
		</button>
	),
}));

vi.mock('@components/bookings/SlotPicker', () => ({
	default: ({
		onChange,
		error,
	}: {
		onChange: (slotId: number) => void;
		error?: string;
	}) => (
		<div>
			<button type="button" onClick={() => onChange(401)}>
				Select slot 401
			</button>
			{error ? <span>{error}</span> : null}
		</div>
	),
}));

const renderBookFromTrip = (entry = '/traveller/bookings/from-trip/18') =>
	render(
		<MemoryRouter initialEntries={[entry]}>
			<Routes>
				<Route path={ROUTES.TRAVELLER_BOOK_FROM_TRIP} element={<BookFromTrip />} />
				<Route path={ROUTES.TRAVELLER_BOOKING_DETAIL} element={<div>booking detail page</div>} />
				<Route path={ROUTES.TRAVELLER_TRIP_DETAIL} element={<div>trip detail page</div>} />
			</Routes>
		</MemoryRouter>,
	);

const buildPlan = (overrides: Partial<TripPlanDetail> = {}): TripPlanDetail => ({
	id: 18,
	title: 'Spring Nepal',
	status: 'planning',
	statusDisplay: 'Planning',
	startDate: '2026-05-20',
	endDate: '2026-05-24',
	totalDays: 5,
	travellersCount: 2,
	estimatedCost: '12000',
	coverImage: '',
	itemCount: 2,
	createdAt: '2026-05-01T00:00:00Z',
	updatedAt: '2026-05-01T00:00:00Z',
	itemsByDay: {
		'1': [
			{
				id: 301,
				listing: {
					id: 10,
					title: 'Pokhara Ridge Hike',
					slug: 'pokhara-ridge-hike',
					destination: 'Pokhara',
					category: 'adventure',
					categoryDisplay: 'Adventure',
					durationType: 'full_day',
					pricePerPerson: '2500',
					durationDisplay: '1 day',
					primaryImageThumbnail: null,
					isBookable: true,
					isActive: true,
				},
				dayNumber: 1,
				order: 0,
				priceSnapshot: '2500',
				durationHoursSnapshot: '6',
				durationTypeSnapshot: 'full_day',
				durationDaysSnapshot: 1,
				durationNightsSnapshot: 0,
				notes: '',
				addedAt: '2026-05-01T00:00:00Z',
				isAvailableForBooking: true,
				availabilityMessage: null,
			},
			{
				id: 302,
				listing: {
					id: 11,
					title: 'Kathmandu Food Walk',
					slug: 'kathmandu-food-walk',
					destination: 'Kathmandu',
					category: 'cultural',
					categoryDisplay: 'Cultural',
					durationType: 'full_day',
					pricePerPerson: '1800',
					durationDisplay: '1 day',
					primaryImageThumbnail: null,
					isBookable: false,
					isActive: true,
				},
				dayNumber: 1,
				order: 1,
				priceSnapshot: '1800',
				durationHoursSnapshot: '4',
				durationTypeSnapshot: 'full_day',
				durationDaysSnapshot: 1,
				durationNightsSnapshot: 0,
				notes: '',
				addedAt: '2026-05-01T00:00:00Z',
				isAvailableForBooking: false,
				availabilityMessage: 'Currently unavailable',
			},
		],
	},
	...overrides,
});

const buildBooking = (overrides: Partial<Booking> = {}): Booking => ({
	id: 71,
	reference: 'BK-71',
	status: 'pending_payment',
	quotedTotal: '5000',
	currency: 'NPR',
	source: 'trip_plan',
	createdAt: '2026-05-01T00:00:00Z',
	items: [],
	...overrides,
});

describe('Book from trip page', () => {
	beforeEach(() => {
		tripPlannerServiceMock.getTripPlan.mockReset();
		publicListingsServiceMock.getPublicSlots.mockReset();
		travellerBookingServiceMock.bookFromTripPlan.mockReset();
		notificationMock.success.mockReset();
	});

	it('blocks booking when the trip is not in planning status', async () => {
		tripPlannerServiceMock.getTripPlan.mockResolvedValueOnce(
			buildPlan({
				status: 'booked',
				statusDisplay: 'Booked',
			}),
		);

		renderBookFromTrip();

		expect(await screen.findByText('Cannot book this trip')).toBeInTheDocument();
		expect(screen.getByText(/Only trips in/i)).toBeInTheDocument();
	});

	it('creates a booking from the available trip items and excludes unavailable items', async () => {
		tripPlannerServiceMock.getTripPlan.mockResolvedValueOnce(buildPlan());
		publicListingsServiceMock.getPublicSlots.mockResolvedValueOnce([
			{
				id: 401,
				startDate: '2026-05-20',
				endDate: null,
				startTime: null,
				endTime: null,
				capacity: 10,
				availableCapacity: 8,
			},
		]);
		travellerBookingServiceMock.bookFromTripPlan.mockResolvedValueOnce(buildBooking());

		const user = userEvent.setup();
		renderBookFromTrip();

		expect(await screen.findByRole('heading', { name: 'Book Your Trip Plan' })).toBeInTheDocument();
		expect(screen.getByText(/1 experience cannot be booked right now/i)).toBeInTheDocument();
		expect(screen.getByText(/Kathmandu Food Walk/i)).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Select Date' }));
		await waitFor(() => {
			expect(publicListingsServiceMock.getPublicSlots).toHaveBeenCalledWith(10, '2026-05-20');
		});

		await user.click(screen.getByRole('button', { name: 'Select slot 401' }));
		await user.click(screen.getByRole('button', { name: 'Confirm & Book 1 Experience' }));

		await waitFor(() => {
			expect(travellerBookingServiceMock.bookFromTripPlan).toHaveBeenCalledWith(
				18,
				{
					items: [{ tripPlanItemId: 301, slotId: 401, travellerCount: 2 }],
				},
				expect.any(String),
			);
		});
		expect(notificationMock.success).toHaveBeenCalledWith(
			'Trip booking created! Complete payment to confirm.',
		);
		expect(await screen.findByText('booking detail page')).toBeInTheDocument();
	});
});
