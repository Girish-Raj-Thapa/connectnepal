import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModerationDashboard from '@pages/admin/reviews/ModerationDashboard';
import type { PaginatedResponse, ReviewReport } from '@/types/reviews';

const adminReviewsServiceMock = vi.hoisted(() => ({
	listReports: vi.fn(),
	moderateReview: vi.fn(),
	moderateReply: vi.fn(),
}));

const notificationMock = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
}));

vi.mock('@services/admin.reviews.service', () => ({
	AdminReviewsService: adminReviewsServiceMock,
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

vi.mock('@components/reviews/ReviewStatusBadge', () => ({
	default: ({ status }: { status: string }) => <div>review-status:{status}</div>,
}));

vi.mock('@components/reviews/ReviewStars', () => ({
	default: ({ rating }: { rating: number }) => <div>stars:{rating}</div>,
}));

vi.mock('@components/reviews/AdminReviewReportModal', () => ({
	default: ({
		report,
		onClose,
		onModerate,
	}: {
		report: ReviewReport;
		onClose: () => void;
		onModerate: (report: ReviewReport, action: string, note: string) => Promise<void>;
	}) => (
		<div role="dialog">
			<div>report modal:{report.id}</div>
			<button type="button" onClick={onClose}>
				close report modal
			</button>
			<button type="button" onClick={() => void onModerate(report, 'mark_removed', 'review removed')}>
				moderate review
			</button>
			<button type="button" onClick={() => void onModerate(report, 'remove_reply', 'reply removed')}>
				moderate reply
			</button>
		</div>
	),
}));

const renderModerationDashboard = () =>
	render(
		<MemoryRouter>
			<ModerationDashboard />
		</MemoryRouter>,
	);

const buildReport = (overrides: Partial<ReviewReport> = {}): ReviewReport => ({
	id: 1,
	reviewId: 55,
	reviewRating: 2,
	reviewComment: 'This contains abusive language.',
	reviewStatus: 'under_review',
	reporterEmail: 'host@example.com',
	targetType: 'review',
	reason: 'abusive_language',
	details: 'Please review this content.',
	status: 'open',
	createdAt: '2026-05-01T00:00:00Z',
	resolvedAt: null,
	resolvedByEmail: null,
	resolutionNote: '',
	...overrides,
});

const buildPage = (
	overrides: Partial<PaginatedResponse<ReviewReport>> = {},
): PaginatedResponse<ReviewReport> => ({
	count: 2,
	next: null,
	previous: null,
	results: [
		buildReport(),
		buildReport({
			id: 2,
			reviewId: 56,
			targetType: 'host_reply',
			reason: 'spam',
			reporterEmail: 'traveller@example.com',
		}),
	],
	...overrides,
});

describe('Moderation dashboard', () => {
	beforeEach(() => {
		adminReviewsServiceMock.listReports.mockReset();
		adminReviewsServiceMock.moderateReview.mockReset();
		adminReviewsServiceMock.moderateReply.mockReset();
		notificationMock.success.mockReset();
		notificationMock.error.mockReset();
	});

	it('loads reports, opens the report modal, and applies moderation actions', async () => {
		adminReviewsServiceMock.listReports.mockResolvedValueOnce(buildPage());
		adminReviewsServiceMock.moderateReview.mockResolvedValueOnce({ id: 55 });

		const user = userEvent.setup();
		renderModerationDashboard();

		expect(await screen.findByText('host@example.com')).toBeInTheDocument();
		expect(screen.getByText('traveller@example.com')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'View report 1' }));
		expect(screen.getByText('report modal:1')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'moderate review' }));

		await waitFor(() => {
			expect(adminReviewsServiceMock.moderateReview).toHaveBeenCalledWith(55, {
				action: 'mark_removed',
				note: 'review removed',
			});
		});
		expect(notificationMock.success).toHaveBeenCalledWith('Moderation action applied.');
		expect(screen.queryByText('host@example.com')).not.toBeInTheDocument();
	});

	it('filters the report list and shows an error state when loading fails', async () => {
		adminReviewsServiceMock.listReports
			.mockResolvedValueOnce(buildPage())
			.mockRejectedValueOnce(new Error('Failed to fetch reports'));

		const user = userEvent.setup();
		renderModerationDashboard();

		expect(await screen.findByText('host@example.com')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Resolved' }));

		expect(await screen.findByText('Failed to fetch reports')).toBeInTheDocument();
		expect(notificationMock.error).toHaveBeenCalledWith('Failed to fetch reports');
	});
});
