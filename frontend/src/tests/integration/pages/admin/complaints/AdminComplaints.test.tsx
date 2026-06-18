import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminComplaints from '@pages/admin/complaints/AdminComplaints';
import { ROUTES } from '@/constants/routes';
import type { ComplaintListItem, PaginatedComplaints } from '@/types/complaints';

const adminComplaintServiceMock = vi.hoisted(() => ({
	list: vi.fn(),
}));

vi.mock('@services/complaints.service', () => ({
	AdminComplaintService: adminComplaintServiceMock,
}));

vi.mock('@/layouts/DashboardLayout', () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@components/common/FilterTabs', () => ({
	default: ({
		tabs,
		active,
		onChange,
	}: {
		tabs: Array<{ value: string; label: string }>;
		active: string;
		onChange: (value: string) => void;
	}) => (
		<div>
			{tabs.map((tab) => (
				<button
					key={tab.value}
					type="button"
					data-active={String(active === tab.value)}
					onClick={() => onChange(tab.value)}
				>
					{tab.label}
				</button>
			))}
		</div>
	),
}));

vi.mock('@components/common/Pagination', () => ({
	default: ({ currentPage }: { currentPage: number }) => <div>pagination:{currentPage}</div>,
}));

vi.mock('@components/complaints/ComplaintStatsCards', () => ({
	default: ({ stats }: { stats: Record<string, number> }) => (
		<div>stats:{stats.urgent}:{stats.open}:{stats.inProgress}:{stats.resolved}</div>
	),
}));

vi.mock('@components/complaints/ComplaintStatusBadge', () => ({
	default: ({ status }: { status: string }) => <div>status:{status}</div>,
}));

vi.mock('@components/complaints/ComplaintSeverityBadge', () => ({
	default: ({ severity }: { severity: string }) => <div>severity:{severity}</div>,
}));

vi.mock('@components/complaints/ComplaintCategoryBadge', () => ({
	default: ({ category }: { category: string }) => <div>category:{category}</div>,
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
				retry admin complaints
			</button>
		</div>
	),
}));

const renderAdminComplaints = () =>
	render(
		<MemoryRouter initialEntries={[ROUTES.ADMIN_COMPLAINTS]}>
			<Routes>
				<Route path={ROUTES.ADMIN_COMPLAINTS} element={<AdminComplaints />} />
				<Route path={ROUTES.ADMIN_COMPLAINT_DETAIL} element={<div>admin complaint detail</div>} />
			</Routes>
		</MemoryRouter>,
	);

const buildComplaint = (
	overrides: Partial<ComplaintListItem> = {},
): ComplaintListItem => ({
	id: 11,
	category: 'host_misconduct',
	title: 'Unsafe guest conduct',
	severity: 'high',
	status: 'under_review',
	filerName: 'Host User',
	filedByRole: 'host',
	targetLabel: 'Booking BK-99',
	eventCount: 2,
	evidenceCount: 1,
	createdAt: '2026-05-01T00:00:00Z',
	...overrides,
});

const buildPage = (
	overrides: Partial<PaginatedComplaints> = {},
): PaginatedComplaints => ({
	count: 1,
	next: null,
	previous: null,
	results: [buildComplaint()],
	...overrides,
});

describe('Admin complaints page', () => {
	beforeEach(() => {
		adminComplaintServiceMock.list.mockReset();
	});

	it('loads complaints, applies filters, and navigates to complaint details', async () => {
		adminComplaintServiceMock.list
			.mockResolvedValueOnce(buildPage())
			.mockResolvedValueOnce(buildPage());

		const user = userEvent.setup();
		renderAdminComplaints();

		expect(await screen.findByText('Unsafe guest conduct')).toBeInTheDocument();
		expect(screen.getByText('stats:1:0:1:0')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Urgent' }));
		await waitFor(() => {
			expect(adminComplaintServiceMock.list).toHaveBeenLastCalledWith({
				page: 1,
				severity: 'critical',
			});
		});

		await user.click(screen.getByRole('button', { name: 'View Details' }));
		await waitFor(() => {
			expect(screen.getByText('admin complaint detail')).toBeInTheDocument();
		});
	});

	it('shows empty and error states and supports retry', async () => {
		adminComplaintServiceMock.list
			.mockResolvedValueOnce(buildPage({ count: 0, results: [] }))
			.mockRejectedValueOnce(new Error('Failed to load complaints'))
			.mockResolvedValueOnce(buildPage());

		const user = userEvent.setup();
		renderAdminComplaints();

		expect(await screen.findByText('No complaints found')).toBeInTheDocument();

		renderAdminComplaints();
		expect(await screen.findByText('Failed to load complaints')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'retry admin complaints' }));
		await waitFor(() => {
			expect(adminComplaintServiceMock.list).toHaveBeenCalledTimes(3);
		});
	});
});
