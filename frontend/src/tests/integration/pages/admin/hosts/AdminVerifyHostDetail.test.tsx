import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminVerifyHostDetail from '@pages/admin/hosts/AdminVerifyHostDetail';
import { ROUTES } from '@/constants/routes';
import type { AdminHostDetail } from '@/types/admin';

const adminHostServiceMock = vi.hoisted(() => ({
	getDetail: vi.fn(),
	approve: vi.fn(),
	reject: vi.fn(),
}));

const confirmMock = vi.hoisted(() => vi.fn());

const notificationMock = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
}));

vi.mock('@services/admin.service', () => ({
	AdminHostService: adminHostServiceMock,
}));

vi.mock('@context/ConfirmContext', () => ({
	useConfirm: () => confirmMock,
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
				retry host detail
			</button>
		</div>
	),
}));

const renderAdminVerifyHostDetail = () =>
	render(
		<MemoryRouter initialEntries={['/admin/verify-hosts/14']}>
			<Routes>
				<Route path={ROUTES.ADMIN_VERIFY_HOST_DETAIL} element={<AdminVerifyHostDetail />} />
				<Route path={ROUTES.ADMIN_VERIFY_HOSTS} element={<div>verify hosts page</div>} />
			</Routes>
		</MemoryRouter>,
	);

const buildHost = (overrides: Partial<AdminHostDetail> = {}): AdminHostDetail => ({
	userId: 14,
	email: 'host@example.com',
	fullName: 'Host Applicant',
	businessName: 'Mountain Trails',
	verificationStatus: 'pending',
	verificationRemarks: null,
	verifiedAt: null,
	documentCount: 2,
	documents: [
		{
			id: 1,
			documentType: 'citizenship',
			filePath: 'https://example.com/citizenship.pdf',
			uploadedAt: '2026-05-01T00:00:00Z',
		},
	],
	...overrides,
});

describe('Admin verify host detail page', () => {
	beforeEach(() => {
		adminHostServiceMock.getDetail.mockReset();
		adminHostServiceMock.approve.mockReset();
		adminHostServiceMock.reject.mockReset();
		confirmMock.mockReset();
		notificationMock.success.mockReset();
		notificationMock.error.mockReset();
	});

	it('loads host details and approves the host after confirmation', async () => {
		adminHostServiceMock.getDetail.mockResolvedValueOnce(buildHost());
		adminHostServiceMock.approve.mockResolvedValueOnce(undefined);
		confirmMock.mockResolvedValueOnce(true);

		const user = userEvent.setup();
		renderAdminVerifyHostDetail();

		expect(await screen.findByRole('heading', { name: 'Host Application Review' })).toBeInTheDocument();
		expect(screen.getByText('Host Applicant')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Approve & Verify Host' }));

		await waitFor(() => {
			expect(confirmMock).toHaveBeenCalled();
		});
		expect(adminHostServiceMock.approve).toHaveBeenCalledWith(14);
		expect(notificationMock.success).toHaveBeenCalledWith('Host approved successfully');
		expect(await screen.findByText('verify hosts page')).toBeInTheDocument();
	});

	it('validates rejection remarks, submits rejection, and supports retry after a load error', async () => {
		adminHostServiceMock.getDetail
			.mockRejectedValueOnce(new Error('Failed to load host details'))
			.mockResolvedValueOnce(buildHost());
		adminHostServiceMock.reject.mockResolvedValueOnce(undefined);

		const user = userEvent.setup();
		renderAdminVerifyHostDetail();

		expect(await screen.findByText('Failed to load host details')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'retry host detail' }));
		expect(await screen.findByText('Host Applicant')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Reject' }));
		expect(screen.getByRole('button', { name: 'Confirm Reject' })).toBeDisabled();

		await user.type(
			screen.getByPlaceholderText('Provide reason for rejection (min 10 characters)...'),
			'Incomplete business documents',
		);
		await user.click(screen.getByRole('button', { name: 'Confirm Reject' }));

		await waitFor(() => {
			expect(adminHostServiceMock.reject).toHaveBeenCalledWith(14, {
				remarks: 'Incomplete business documents',
			});
		});
		expect(notificationMock.success).toHaveBeenCalledWith('Host rejected');
		expect(await screen.findByText('verify hosts page')).toBeInTheDocument();
	});
});
