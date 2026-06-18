import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PublicListings from '@pages/public/listings/PublicListings';
import type { PublicListing, PaginatedResponse } from '@/types/listings';
import type { PublicPackageListResponse, PublicPackageSummary } from '@/types/packages';

type AuthContextMockValue = {
	user: { role: 'traveller' | 'host' | 'admin'; email: string } | null;
};

const useAuthMock = vi.hoisted(() => vi.fn<() => AuthContextMockValue>());
const useForYouListingsMock = vi.hoisted(() => vi.fn());
const useForYouPackagesMock = vi.hoisted(() => vi.fn());
const publicListingsServiceMock = vi.hoisted(() => ({
	getPublicListings: vi.fn(),
}));
const publicPackagesServiceMock = vi.hoisted(() => ({
	listPackages: vi.fn(),
}));
const notificationMock = vi.hoisted(() => ({
	error: vi.fn(),
	success: vi.fn(),
	info: vi.fn(),
}));
const recommendationsServiceMock = vi.hoisted(() => ({
	sendInteractions: vi.fn(),
}));

vi.mock('@context/AuthContext', () => ({
	useAuth: useAuthMock,
}));

vi.mock('@/hooks/useRecommendations', () => ({
	useForYouListings: useForYouListingsMock,
	useForYouPackages: useForYouPackagesMock,
}));

vi.mock('@services/publicListings.service', () => ({
	default: publicListingsServiceMock,
}));

vi.mock('@/services/publicPackages.service', () => ({
	default: publicPackagesServiceMock,
}));

vi.mock('@/utils/notifications', () => ({
	default: notificationMock,
}));

vi.mock('@services/recommendations.service', () => ({
	default: recommendationsServiceMock,
}));

vi.mock('@components/layout/Navbar', () => ({
	default: () => <div>navbar</div>,
}));

vi.mock('@/components/feedback/PageLoader', () => ({
	default: () => <div>page loader</div>,
}));

vi.mock('@/components/listings/ListingCard', () => ({
	default: ({
		listing,
		onNavigate,
	}: {
		listing: PublicListing;
		onNavigate?: () => void;
	}) => (
		<button type="button" onClick={onNavigate}>
			listing:{listing.title}
		</button>
	),
}));

vi.mock('@/components/packages/PublicPackageCard', () => ({
	default: ({ pkg }: { pkg: PublicPackageSummary }) => <div>package:{pkg.title}</div>,
}));

vi.mock('@/components/listings/Pagination', () => ({
	default: ({ currentPage }: { currentPage: number }) => <div>pagination:{currentPage}</div>,
}));

vi.mock('@components/packages/PackageFilters', () => ({
	default: () => <div>package filters</div>,
}));

vi.mock('@components/listings/RecommendationGrid', () => ({
	default: ({
		title,
		listings,
	}: {
		title: string;
		listings: PublicListing[];
	}) => (
		<div data-testid="listing-recommendations">
			{title}:{listings.length}
		</div>
	),
}));

vi.mock('@components/packages/PackageRecommendationGrid', () => ({
	default: ({
		title,
		packages,
	}: {
		title: string;
		packages: PublicPackageSummary[];
	}) => (
		<div data-testid="package-recommendations">
			{title}:{packages.length}
		</div>
	),
}));

const renderPublicListings = (entry = '/listings') =>
	render(
		<MemoryRouter initialEntries={[entry]}>
			<PublicListings />
		</MemoryRouter>,
	);

const buildListing = (overrides: Partial<PublicListing> = {}): PublicListing => ({
	id: 1,
	slug: 'pokhara-hike',
	title: 'Pokhara Ridge Hike',
	shortDescription: 'A scenic day hike above the lake.',
	destination: 'Pokhara',
	category: 'adventure',
	categoryDisplay: 'Adventure',
	activityType: 'hiking',
	difficultyLevel: 'easy',
	difficultyDisplay: 'Easy',
	pricePerPerson: '2500',
	durationType: 'full_day',
	averageDurationHours: '6',
	durationDays: 1,
	durationNights: 0,
	durationDisplay: '1 day',
	ratingAverage: '4.7',
	ratingCount: 18,
	position: 1,
	instantBooking: true,
	hostName: 'Trail Guides Nepal',
	hostIsVerified: true,
	primaryImageThumbnail: 'https://example.com/listing.jpg',
	...overrides,
});

const buildPublicListingsResponse = (
	overrides: Partial<PaginatedResponse<PublicListing>> = {},
): PaginatedResponse<PublicListing> => ({
	count: 1,
	next: null,
	previous: null,
	results: [buildListing()],
	...overrides,
});

const buildPackage = (
	overrides: Partial<PublicPackageSummary> = {},
): PublicPackageSummary => ({
	id: 41,
	title: 'Annapurna Highlights',
	slug: 'annapurna-highlights',
	description: 'Curated multi-day package',
	durationDays: 4,
	durationNights: 3,
	totalPrice: '18000',
	discountLabel: 'Save 10%',
	tags: ['trekking'],
	listingCount: 3,
	coverImageUrl: 'https://example.com/package.jpg',
	hostName: 'Annapurna Local Co',
	bookingCount: 5,
	hasUpcomingSlots: true,
	nextAvailableSlot: { id: 71, startDate: '2026-05-20', endDate: '2026-05-23' },
	createdAt: '2026-01-01T00:00:00Z',
	...overrides,
});

const buildPackageResponse = (
	overrides: Partial<PublicPackageListResponse> = {},
): PublicPackageListResponse => ({
	count: 1,
	next: null,
	previous: null,
	results: [buildPackage()],
	...overrides,
});

describe('Public listings page', () => {
	beforeEach(() => {
		useAuthMock.mockReset();
		useForYouListingsMock.mockReset();
		useForYouPackagesMock.mockReset();
		publicListingsServiceMock.getPublicListings.mockReset();
		publicPackagesServiceMock.listPackages.mockReset();
		notificationMock.error.mockReset();
		recommendationsServiceMock.sendInteractions.mockReset();

		useAuthMock.mockReturnValue({
			user: { role: 'traveller', email: 'traveller@example.com' },
		});
		useForYouListingsMock.mockReturnValue({
			listings: [],
			meta: null,
			loading: false,
			error: null,
		});
		useForYouPackagesMock.mockReturnValue({
			packages: [],
			meta: null,
			loading: false,
			error: null,
		});
	});

	it('loads and renders public experience results on the default tab', async () => {
		publicListingsServiceMock.getPublicListings.mockResolvedValueOnce(
			buildPublicListingsResponse(),
		);

		renderPublicListings();

		expect(screen.getByText('page loader')).toBeInTheDocument();
		expect(await screen.findByRole('button', { name: 'listing:Pokhara Ridge Hike' })).toBeInTheDocument();
		expect(
			screen.getByText((_, element) => element?.textContent === 'Showing 1 experience'),
		).toBeInTheDocument();
		expect(screen.getByText('pagination:1')).toBeInTheDocument();
		expect(publicListingsServiceMock.getPublicListings).toHaveBeenCalledWith(
			expect.objectContaining({
				ordering: '-created_at',
				page: 1,
			}),
		);
	});

	it('shows an error state and retries the listings request', async () => {
		publicListingsServiceMock.getPublicListings
			.mockRejectedValueOnce(new Error('Failed to load listings'))
			.mockResolvedValueOnce(buildPublicListingsResponse());

		const user = userEvent.setup();
		renderPublicListings();

		expect(await screen.findByText('Failed to load listings')).toBeInTheDocument();
		expect(notificationMock.error).toHaveBeenCalledWith('Failed to load listings');

		await user.click(screen.getByRole('button', { name: 'Try Again' }));

		expect(await screen.findByRole('button', { name: 'listing:Pokhara Ridge Hike' })).toBeInTheDocument();
		expect(publicListingsServiceMock.getPublicListings).toHaveBeenCalledTimes(2);
	});

	it('switches to the packages tab and renders package results plus recommendations', async () => {
		publicPackagesServiceMock.listPackages.mockResolvedValueOnce(buildPackageResponse());
		useForYouPackagesMock.mockReturnValue({
			packages: [buildPackage({ id: 51, title: 'Mustang Escape' })],
			meta: null,
			loading: false,
			error: null,
		});

		renderPublicListings('/listings?tab=packages');

		expect(screen.getByText('page loader')).toBeInTheDocument();
		expect(await screen.findByText('package:Annapurna Highlights')).toBeInTheDocument();
		expect(
			screen.getByText((_, element) => element?.textContent === 'Showing 1 package'),
		).toBeInTheDocument();
		expect(screen.getByTestId('package-recommendations')).toHaveTextContent(
			'Recommended Packages For You:1',
		);
		expect(publicPackagesServiceMock.listPackages).toHaveBeenCalledWith(
			expect.objectContaining({
				ordering: '-created_at',
				page: 1,
			}),
		);
	});

	it('tracks browse-card clicks for authenticated users', async () => {
		publicListingsServiceMock.getPublicListings.mockResolvedValueOnce(
			buildPublicListingsResponse(),
		);

		const user = userEvent.setup();
		renderPublicListings();

		await user.click(
			await screen.findByRole('button', { name: 'listing:Pokhara Ridge Hike' }),
		);

		await waitFor(() => {
			expect(recommendationsServiceMock.sendInteractions).toHaveBeenCalledWith([
				{
					listingId: 1,
					eventType: 'click',
					surface: 'catalog',
					position: 1,
				},
			]);
		});
	});
});
