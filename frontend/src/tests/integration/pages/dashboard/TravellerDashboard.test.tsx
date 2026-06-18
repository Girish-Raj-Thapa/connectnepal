import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TravellerDashboard from '@pages/traveller/TravellerDashboard';
import type { TravellerOverviewResponse } from '@/types/analytics';

type AuthContextMockValue = {
	user: { firstName?: string; email: string } | null;
};

const useAuthMock = vi.hoisted(() => vi.fn<() => AuthContextMockValue>());
const useAnalyticsMock = vi.hoisted(() => vi.fn());

vi.mock('@context/AuthContext', () => ({
	useAuth: useAuthMock,
}));

vi.mock('@/hooks/useAnalytics', () => ({
	useAnalytics: useAnalyticsMock,
}));

vi.mock('@/layouts/DashboardLayout', () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@components/feedback/Loader', () => ({
	default: ({ text }: { text?: string }) => <div>{text ?? 'loading'}</div>,
}));

vi.mock('@components/dashboard/DashboardError', () => ({
	default: ({
		message,
		onRetry,
	}: {
		message: string;
		onRetry: () => void;
	}) => (
		<div>
			<div>{message}</div>
			<button type="button" onClick={onRetry}>
				retry dashboard
			</button>
		</div>
	),
}));

vi.mock('@components/dashboard/StatCard', () => ({
	default: ({ label, value }: { label: string; value: string | number }) => (
		<div>
			{label}:{value}
		</div>
	),
}));

vi.mock('@components/common/TableActionIcon', () => ({
	default: ({ label }: { label: string }) => <div>{label}</div>,
}));

const renderTravellerDashboard = () =>
	render(
		<MemoryRouter>
			<TravellerDashboard />
		</MemoryRouter>,
	);

const buildTravellerOverview = (): TravellerOverviewResponse => ({
	summary: {
		activeTripPlans: 2,
		upcomingBookings: 4,
		completedTrips: 6,
		reviewsWritten: 3,
	},
	previews: {
		upcomingBookings: [
			{
				bookingItemId: 1,
				bookingId: 101,
				bookingReference: 'BK-101',
				targetType: 'listing',
				targetId: 91,
				title: 'Everest View Trek',
				startDate: '2026-05-10',
				endDate: '2026-05-12',
				status: 'confirmed',
				quotedTotal: '5000',
				currency: 'NPR',
			},
			{
				bookingItemId: 2,
				bookingId: 102,
				bookingReference: 'BK-102',
				targetType: 'listing',
				targetId: 92,
				title: 'Bhaktapur Food Walk',
				startDate: '2026-05-15',
				endDate: null,
				status: 'pending_payment',
				quotedTotal: '2500',
				currency: 'NPR',
			},
			{
				bookingItemId: 3,
				bookingId: 103,
				bookingReference: 'BK-103',
				targetType: 'package',
				targetId: 93,
				title: 'Mustang Escape',
				startDate: '2026-05-18',
				endDate: '2026-05-21',
				status: 'confirmed',
				quotedTotal: '12000',
				currency: 'NPR',
			},
			{
				bookingItemId: 4,
				bookingId: 104,
				bookingReference: 'BK-104',
				targetType: 'listing',
				targetId: 94,
				title: 'Hidden Booking',
				startDate: '2026-05-30',
				endDate: null,
				status: 'confirmed',
				quotedTotal: '7000',
				currency: 'NPR',
			},
		],
		tripPlans: [
			{
				id: 1,
				title: 'Spring Nepal Loop',
				status: 'planning',
				statusDisplay: 'Planning',
				startDate: null,
				endDate: null,
				estimatedCost: '10000',
				updatedAt: '2026-04-01T00:00:00Z',
			},
			{
				id: 2,
				title: 'Pokhara Weekend',
				status: 'active',
				statusDisplay: 'Active',
				startDate: null,
				endDate: null,
				estimatedCost: '6000',
				updatedAt: '2026-04-02T00:00:00Z',
			},
			{
				id: 3,
				title: 'Hidden Trip Plan',
				status: 'planning',
				statusDisplay: 'Planning',
				startDate: null,
				endDate: null,
				estimatedCost: '4000',
				updatedAt: '2026-04-03T00:00:00Z',
			},
		],
	},
});

describe('Traveller dashboard', () => {
	beforeEach(() => {
		useAuthMock.mockReset();
		useAnalyticsMock.mockReset();
		useAuthMock.mockReturnValue({
			user: { firstName: 'Girish', email: 'traveller@example.com' },
		});
	});

	it('shows the loading state while analytics are pending', () => {
		useAnalyticsMock.mockReturnValue({
			data: null,
			loading: true,
			error: '',
			refetch: vi.fn(),
		});

		renderTravellerDashboard();

		expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
	});

	it('shows the dashboard error state and retries on demand', async () => {
		const refetch = vi.fn();
		useAnalyticsMock.mockReturnValue({
			data: null,
			loading: false,
			error: 'Failed to load dashboard data',
			refetch,
		});

		const user = userEvent.setup();
		renderTravellerDashboard();

		expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'retry dashboard' }));

		expect(refetch).toHaveBeenCalledTimes(1);
	});

	it('renders summary cards and trims booking/trip previews to the dashboard limits', () => {
		useAnalyticsMock.mockReturnValue({
			data: buildTravellerOverview(),
			loading: false,
			error: '',
			refetch: vi.fn(),
		});

		renderTravellerDashboard();

		expect(screen.getByRole('heading', { name: 'Welcome back, Girish!' })).toBeInTheDocument();
		expect(screen.getByText('Active Trip Plans:2')).toBeInTheDocument();
		expect(screen.getByText('Upcoming Bookings:4')).toBeInTheDocument();
		expect(screen.getByText('Plan a Trip')).toBeInTheDocument();
		expect(screen.getByText('Everest View Trek')).toBeInTheDocument();
		expect(screen.getByText('Mustang Escape')).toBeInTheDocument();
		expect(screen.queryByText('Hidden Booking')).not.toBeInTheDocument();
		expect(screen.getByText('Spring Nepal Loop')).toBeInTheDocument();
		expect(screen.getByText('Pokhara Weekend')).toBeInTheDocument();
		expect(screen.queryByText('Hidden Trip Plan')).not.toBeInTheDocument();
	});
});
