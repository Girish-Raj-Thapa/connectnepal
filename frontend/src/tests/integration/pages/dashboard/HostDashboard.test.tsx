import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HostDashboard from '@pages/host/HostDashboard';
import type { HostOverviewResponse } from '@/types/analytics';

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

vi.mock('@components/dashboard/TrendChart', () => ({
	default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@components/bookings/BookingStatusBadge', () => ({
	default: ({ status }: { status: string }) => <div>status:{status}</div>,
}));

const renderHostDashboard = () =>
	render(
		<MemoryRouter>
			<HostDashboard />
		</MemoryRouter>,
	);

const buildHostOverview = (): HostOverviewResponse => ({
	summary: {
		activeListings: 5,
		totalBookings: 18,
		thisMonthEarnings: '25000',
		averageRating: '4.8',
		reviewCount: 9,
	},
	trends: {
		monthlyEarnings: [
			{ month: '2026-01', amount: '10000' },
			{ month: '2026-02', amount: '15000' },
		],
		monthlyBookings: [
			{ month: '2026-01', count: 4 },
			{ month: '2026-02', count: 6 },
		],
	},
	previews: {
		recentBookings: [
			{
				bookingItemId: 1,
				bookingId: 201,
				bookingReference: 'BK-201',
				targetType: 'listing',
				targetId: 101,
				title: 'Langtang Walk',
				travellerName: 'Asha',
				travellerEmail: 'asha@example.com',
				status: 'confirmed',
				startDate: '2026-06-01',
				endDate: null,
				quotedTotal: '5000',
				currency: 'NPR',
				createdAt: '2026-05-01T00:00:00Z',
			},
			{
				bookingItemId: 2,
				bookingId: 202,
				bookingReference: 'BK-202',
				targetType: 'listing',
				targetId: 102,
				title: 'Pokhara Paddle',
				travellerName: null,
				travellerEmail: 'guest@example.com',
				status: 'pending_payment',
				startDate: '2026-06-05',
				endDate: null,
				quotedTotal: '4200',
				currency: 'NPR',
				createdAt: '2026-05-02T00:00:00Z',
			},
			{
				bookingItemId: 3,
				bookingId: 203,
				bookingReference: 'BK-203',
				targetType: 'package',
				targetId: 103,
				title: 'Mustang Escape',
				travellerName: 'Ramesh',
				travellerEmail: 'ramesh@example.com',
				status: 'confirmed',
				startDate: '2026-06-10',
				endDate: '2026-06-12',
				quotedTotal: '12000',
				currency: 'NPR',
				createdAt: '2026-05-03T00:00:00Z',
			},
			{
				bookingItemId: 4,
				bookingId: 204,
				bookingReference: 'BK-204',
				targetType: 'listing',
				targetId: 104,
				title: 'Hidden Booking',
				travellerName: 'Hidden Guest',
				travellerEmail: 'hidden@example.com',
				status: 'confirmed',
				startDate: '2026-06-14',
				endDate: null,
				quotedTotal: '3000',
				currency: 'NPR',
				createdAt: '2026-05-04T00:00:00Z',
			},
		],
		topPerformingListings: [
			{
				listingId: 1,
				title: 'Langtang Walk',
				category: 'adventure',
				destination: 'Kathmandu',
				bookingCount: 8,
				ratingAverage: '4.9',
				ratingCount: 12,
				isActive: true,
				isBookable: true,
			},
			{
				listingId: 2,
				title: 'Pokhara Paddle',
				category: 'adventure',
				destination: 'Pokhara',
				bookingCount: 6,
				ratingAverage: '4.7',
				ratingCount: 8,
				isActive: true,
				isBookable: true,
			},
			{
				listingId: 3,
				title: 'Bhaktapur Walk',
				category: 'cultural',
				destination: 'Bhaktapur',
				bookingCount: 5,
				ratingAverage: '4.6',
				ratingCount: 7,
				isActive: true,
				isBookable: true,
			},
			{
				listingId: 4,
				title: 'Hidden Listing',
				category: 'nature',
				destination: 'Chitwan',
				bookingCount: 2,
				ratingAverage: '4.2',
				ratingCount: 4,
				isActive: true,
				isBookable: true,
			},
		],
	},
});

describe('Host dashboard', () => {
	beforeEach(() => {
		useAuthMock.mockReset();
		useAnalyticsMock.mockReset();
		useAuthMock.mockReturnValue({
			user: { firstName: 'Hosty', email: 'host@example.com' },
		});
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
		renderHostDashboard();

		expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'retry dashboard' }));

		expect(refetch).toHaveBeenCalledTimes(1);
	});

	it('renders host metrics, charts, and preview tables with dashboard limits applied', () => {
		useAnalyticsMock.mockReturnValue({
			data: buildHostOverview(),
			loading: false,
			error: '',
			refetch: vi.fn(),
		});

		renderHostDashboard();

		expect(screen.getByRole('heading', { name: 'Welcome back, Hosty!' })).toBeInTheDocument();
		expect(screen.getByText('Active Listings:5')).toBeInTheDocument();
		expect(screen.getByText('Total Bookings:18')).toBeInTheDocument();
		expect(screen.getByText('Monthly Earnings')).toBeInTheDocument();
		expect(screen.getByText('Bookings Trend')).toBeInTheDocument();
		expect(screen.getAllByText('Langtang Walk')).toHaveLength(2);
		expect(screen.getByText('Mustang Escape')).toBeInTheDocument();
		expect(screen.queryByText('Hidden Booking')).not.toBeInTheDocument();
		expect(screen.getByText('Bhaktapur Walk')).toBeInTheDocument();
		expect(screen.queryByText('Hidden Listing')).not.toBeInTheDocument();
	});
});
