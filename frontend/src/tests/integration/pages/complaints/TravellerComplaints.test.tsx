import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TravellerComplaints from '@pages/traveller/complaints/TravellerComplaints';
import { ROUTES } from '@/constants/routes';
import type { ComplaintListItem, PaginatedComplaints } from '@/types/complaints';

const travellerComplaintServiceMock = vi.hoisted(() => ({
	listFiled: vi.fn(),
	listReceived: vi.fn(),
}));

vi.mock('@services/complaints.service', () => ({
	TravellerComplaintService: travellerComplaintServiceMock,
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
				retry complaints
			</button>
		</div>
	),
}));

const renderTravellerComplaints = () =>
	render(
		<MemoryRouter initialEntries={[ROUTES.TRAVELLER_COMPLAINTS]}>
			<Routes>
				<Route path={ROUTES.TRAVELLER_COMPLAINTS} element={<TravellerComplaints />} />
				<Route
					path={ROUTES.TRAVELLER_COMPLAINT_DETAIL}
					element={<div>filed complaint detail</div>}
				/>
				<Route
					path={ROUTES.TRAVELLER_RECEIVED_COMPLAINT_DETAIL}
					element={<div>received complaint detail</div>}
				/>
			</Routes>
		</MemoryRouter>,
	);

const buildComplaint = (
	overrides: Partial<ComplaintListItem> = {},
): ComplaintListItem => ({
	id: 1,
	category: 'refund_dispute',
	title: 'Refund was delayed',
	severity: 'medium',
	status: 'submitted',
	filerName: 'Girish',
	filedByRole: 'traveller',
	targetLabel: 'Pokhara Ridge Hike',
	eventCount: 1,
	evidenceCount: 0,
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

describe('Traveller complaints page', () => {
	beforeEach(() => {
		travellerComplaintServiceMock.listFiled.mockReset();
		travellerComplaintServiceMock.listReceived.mockReset();
	});

	it('loads filed complaints, filters by status, and navigates to complaint details', async () => {
		travellerComplaintServiceMock.listFiled.mockResolvedValue(buildPage());
		travellerComplaintServiceMock.listReceived.mockResolvedValue(
			buildPage({
				results: [
					buildComplaint({
						id: 2,
						title: 'Host filed complaint',
						filedByRole: 'host',
						targetLabel: 'Booking BK-22',
					}),
				],
			}),
		);

		const user = userEvent.setup();
		renderTravellerComplaints();

		expect(await screen.findByText('Refund was delayed')).toBeInTheDocument();
		expect(travellerComplaintServiceMock.listFiled).toHaveBeenCalledWith({
			page: 1,
			status: undefined,
		});

		await user.click(screen.getByRole('button', { name: 'Submitted' }));
		await waitFor(() => {
			expect(travellerComplaintServiceMock.listFiled).toHaveBeenLastCalledWith({
				page: 1,
				status: 'submitted',
			});
		});

		await user.click(screen.getByText('Refund was delayed'));
		await waitFor(() => {
			expect(screen.getByText('filed complaint detail')).toBeInTheDocument();
		});

		renderTravellerComplaints();
		await user.click(await screen.findByRole('button', { name: /Filed Against Me/i }));
		expect(await screen.findByText('Host filed complaint')).toBeInTheDocument();

		await user.click(screen.getByText('Host filed complaint'));
		await waitFor(() => {
			expect(screen.getByText('received complaint detail')).toBeInTheDocument();
		});
	});

	it('shows empty and error states for complaint lists', async () => {
		travellerComplaintServiceMock.listFiled
			.mockResolvedValueOnce(buildPage({ count: 0, results: [] }))
			.mockRejectedValueOnce(new Error('Failed to load complaints'));
		travellerComplaintServiceMock.listReceived.mockResolvedValue(buildPage({ count: 0, results: [] }));

		const user = userEvent.setup();
		renderTravellerComplaints();

		expect(await screen.findByText('No complaints found')).toBeInTheDocument();

		renderTravellerComplaints();
		expect(await screen.findByText('Failed to load complaints')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'retry complaints' }));
		expect(travellerComplaintServiceMock.listFiled).toHaveBeenCalledTimes(3);
	});
});
