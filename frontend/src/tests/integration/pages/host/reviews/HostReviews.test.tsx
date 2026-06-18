import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HostReviews from '@pages/host/reviews/HostReviews';
import type { HostInboxReview, PaginatedResponse } from '@/types/reviews';

const reviewsServiceMock = vi.hoisted(() => ({
	listHostReviews: vi.fn(),
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

vi.mock('@components/reviews/HostReviewViewModal', () => ({
	default: ({ review }: { review: HostInboxReview }) => <div>view host review:{review.id}</div>,
}));

vi.mock('@components/reviews/ReplyReviewModal', () => ({
	default: ({
		review,
		onSuccess,
		onClose,
	}: {
		review: HostInboxReview;
		onSuccess: (review: HostInboxReview) => void;
		onClose: () => void;
	}) => (
		<div role="dialog">
			<div>reply modal:{review.id}</div>
			<button
				type="button"
				onClick={() =>
					onSuccess({
						...review,
						hasReply: true,
						hostReply: 'Thanks for the feedback!',
					})
				}
			>
				save reply
			</button>
			<button type="button" onClick={onClose}>
				close reply modal
			</button>
		</div>
	),
}));

vi.mock('@components/reviews/ReportReviewModal', () => ({
	default: ({
		reviewId,
		onSuccess,
		onClose,
	}: {
		reviewId: number;
		onSuccess: () => void;
		onClose: () => void;
	}) => (
		<div role="dialog">
			<div>report modal:{reviewId}</div>
			<button type="button" onClick={onSuccess}>
				confirm report
			</button>
			<button type="button" onClick={onClose}>
				close report modal
			</button>
		</div>
	),
}));

vi.mock('@components/reviews/ReviewStars', () => ({
	default: ({ rating }: { rating: number }) => <div>stars:{rating}</div>,
}));

vi.mock('@components/reviews/ReviewStatusBadge', () => ({
	default: ({ status }: { status: string }) => <div>review-status:{status}</div>,
}));

const renderHostReviews = () =>
	render(
		<MemoryRouter>
			<HostReviews />
		</MemoryRouter>,
	);

const buildReview = (overrides: Partial<HostInboxReview> = {}): HostInboxReview => ({
	id: 1,
	traveller: { id: 5, firstName: 'Traveller' },
	listingId: 10,
	packageId: null,
	listingTitle: 'Pokhara Ridge Hike',
	packageTitle: null,
	rating: 5,
	comment: 'Fantastic trip',
	status: 'published',
	hostReply: '',
	hostReplyStatus: 'none',
	hostRepliedAt: null,
	hasReply: false,
	editedAt: null,
	editCount: 0,
	canEdit: false,
	canDelete: false,
	createdAt: '2026-05-02T00:00:00Z',
	canReply: true,
	reportCount: 0,
	...overrides,
});

const buildPage = (
	overrides: Partial<PaginatedResponse<HostInboxReview>> = {},
): PaginatedResponse<HostInboxReview> => ({
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
			hasReply: true,
			hostReply: 'Thank you!',
			reportCount: 2,
		}),
	],
	...overrides,
});

describe('Host reviews page', () => {
	beforeEach(() => {
		reviewsServiceMock.listHostReviews.mockReset();
		notificationMock.error.mockReset();
	});

	it('loads host reviews, filters by reply status, and updates the list after a reply', async () => {
		reviewsServiceMock.listHostReviews.mockResolvedValueOnce(buildPage());

		const user = userEvent.setup();
		renderHostReviews();

		expect(await screen.findByRole('heading', { name: 'Reviews' })).toBeInTheDocument();
		expect(screen.getByText('Annapurna Highlights')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Awaiting Reply' }));
		expect(screen.queryByText('Annapurna Highlights')).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /Reply to review for Pokhara Ridge Hike/i }));
		expect(screen.getByText('reply modal:1')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'save reply' }));
		expect(screen.queryByText('reply modal:1')).not.toBeInTheDocument();
		expect(screen.getByText('Replied')).toBeInTheDocument();
	});

	it('opens the report flow and shows the load error state', async () => {
		reviewsServiceMock.listHostReviews
			.mockResolvedValueOnce(buildPage())
			.mockRejectedValueOnce(new Error('Failed to load reviews'));

		const user = userEvent.setup();
		renderHostReviews();

		expect(await screen.findByRole('heading', { name: 'Reviews' })).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /Report review for Pokhara Ridge Hike/i }));
		expect(screen.getByText('report modal:1')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'confirm report' }));
		expect(screen.queryByText('report modal:1')).not.toBeInTheDocument();

		renderHostReviews();
		expect(await screen.findByText('Failed to load reviews')).toBeInTheDocument();
		expect(notificationMock.error).toHaveBeenCalledWith('Failed to load reviews');
	});
});
