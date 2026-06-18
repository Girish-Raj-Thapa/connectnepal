import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TravellerReviews from '@pages/traveller/reviews/TravellerReviews';
import type { PaginatedResponse, Review } from '@/types/reviews';

const reviewsServiceMock = vi.hoisted(() => ({
	listMyReviews: vi.fn(),
	deleteReview: vi.fn(),
}));

const notificationMock = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
}));

vi.mock('@services/reviews.service', () => ({
	default: reviewsServiceMock,
}));

vi.mock('@utils/notifications', () => ({
	default: notificationMock,
}));

vi.mock('@/layouts/DashboardLayout', () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@components/button/Button', () => ({
	default: ({
		children,
		onClick,
		disabled,
	}: {
		children: React.ReactNode;
		onClick?: () => void;
		disabled?: boolean;
	}) => (
		<button type="button" onClick={onClick} disabled={disabled}>
			{children}
		</button>
	),
}));

vi.mock('@components/common/Pagination', () => ({
	default: ({ currentPage }: { currentPage: number }) => <div>pagination:{currentPage}</div>,
}));

vi.mock('@components/common/TableActionIcon', () => ({
	default: ({
		label,
		onClick,
	}: {
		label: string;
		onClick?: () => void;
	}) => (
		<button type="button" onClick={onClick}>
			{label}
		</button>
	),
}));

vi.mock('@components/feedback/Loader', () => ({
	default: ({ text }: { text?: string }) => <div>{text ?? 'loading'}</div>,
}));

vi.mock('@components/reviews/EditReviewModal', () => ({
	default: () => <div>edit review modal</div>,
}));

vi.mock('@components/reviews/ReportReviewModal', () => ({
	default: () => <div>report review modal</div>,
}));

vi.mock('@components/reviews/ReviewStars', () => ({
	default: ({ rating }: { rating: number }) => <div>stars:{rating}</div>,
}));

vi.mock('@components/reviews/ReviewStatusBadge', () => ({
	default: ({ status }: { status: string }) => <div>status:{status}</div>,
}));

vi.mock('@components/reviews/ViewReviewModal', () => ({
	default: ({ review }: { review: Review }) => <div>view review:{review.id}</div>,
}));

const renderTravellerReviews = () =>
	render(
		<MemoryRouter>
			<TravellerReviews />
		</MemoryRouter>,
	);

const buildReview = (overrides: Partial<Review> = {}): Review => ({
	id: 1,
	traveller: { id: 5, firstName: 'Girish' },
	listingId: 91,
	packageId: null,
	listingTitle: 'Pokhara Ridge Hike',
	packageTitle: null,
	rating: 4,
	comment: 'Great trip',
	status: 'published',
	hostReply: 'Thanks!',
	hostReplyStatus: 'published',
	hostRepliedAt: '2026-05-02T00:00:00Z',
	hasReply: true,
	editedAt: null,
	editCount: 0,
	canEdit: true,
	canDelete: true,
	createdAt: '2026-05-01T00:00:00Z',
	...overrides,
});

const buildPage = (
	overrides: Partial<PaginatedResponse<Review>> = {},
): PaginatedResponse<Review> => ({
	count: 2,
	next: null,
	previous: null,
	results: [
		buildReview(),
		buildReview({
			id: 2,
			listingId: null,
			packageId: 44,
			listingTitle: null,
			packageTitle: 'Annapurna Highlights',
			status: 'removed',
			canEdit: false,
			canDelete: false,
			hasReply: false,
			hostReply: '',
			hostReplyStatus: 'none',
		}),
	],
	...overrides,
});

describe('Traveller reviews page', () => {
	beforeEach(() => {
		reviewsServiceMock.listMyReviews.mockReset();
		reviewsServiceMock.deleteReview.mockReset();
		notificationMock.success.mockReset();
		notificationMock.error.mockReset();
	});

	it('loads reviews, filters them by status, and opens the view modal', async () => {
		reviewsServiceMock.listMyReviews.mockResolvedValue(buildPage());

		const user = userEvent.setup();
		renderTravellerReviews();

		expect(await screen.findByText('Pokhara Ridge Hike')).toBeInTheDocument();
		expect(screen.getByText('Annapurna Highlights')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Removed' }));
		expect(screen.queryByText('Pokhara Ridge Hike')).not.toBeInTheDocument();
		expect(screen.getByText('Annapurna Highlights')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'All' }));
		await user.click(screen.getByRole('button', { name: /View review for Pokhara Ridge Hike/i }));
		expect(screen.getByText('view review:1')).toBeInTheDocument();
	});

	it('deletes a review and updates local state, and shows an error banner when loading fails', async () => {
		reviewsServiceMock.listMyReviews
			.mockResolvedValueOnce(buildPage())
			.mockRejectedValueOnce(new Error('Failed to fetch reviews'));
		reviewsServiceMock.deleteReview.mockResolvedValue(undefined);

		const user = userEvent.setup();
		renderTravellerReviews();

		expect(await screen.findByText('Pokhara Ridge Hike')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /Delete review for Pokhara Ridge Hike/i }));
		expect(screen.getByRole('dialog')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Delete' }));

		await waitFor(() => {
			expect(reviewsServiceMock.deleteReview).toHaveBeenCalledWith(1);
		});
		expect(notificationMock.success).toHaveBeenCalledWith('Review deleted.');
		expect(screen.queryByText('Pokhara Ridge Hike')).not.toBeInTheDocument();

		renderTravellerReviews();
		expect(await screen.findByText('Failed to fetch reviews')).toBeInTheDocument();
		expect(notificationMock.error).toHaveBeenCalledWith('Failed to fetch reviews');
	});
});
