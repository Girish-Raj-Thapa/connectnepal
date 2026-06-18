import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationsPage from '@pages/notifications/NotificationsPage';
import { ROUTES } from '@/constants/routes';
import type { NotificationItem, PaginatedNotifications } from '@/types/notifications';

type AuthContextMockValue = {
	user: { role: 'traveller' | 'host' | 'admin'; email: string } | null;
};

type NotificationsContextMockValue = {
	unreadCount: number;
	markAsRead: (id: number) => Promise<NotificationItem>;
	markAllAsRead: () => Promise<{ updated: number; unreadCount: number }>;
};

const useAuthMock = vi.hoisted(() => vi.fn<() => AuthContextMockValue>());
const useNotificationsMock = vi.hoisted(() => vi.fn<() => NotificationsContextMockValue>());
const notificationsServiceMock = vi.hoisted(() => ({
	list: vi.fn(),
}));
const notificationToastMock = vi.hoisted(() => ({
	error: vi.fn(),
	success: vi.fn(),
	info: vi.fn(),
}));

vi.mock('@context/AuthContext', () => ({
	useAuth: useAuthMock,
}));

vi.mock('@context/NotificationsContext', () => ({
	useNotifications: useNotificationsMock,
}));

vi.mock('@services/notifications.service', () => ({
	default: notificationsServiceMock,
}));

vi.mock('@utils/notifications', () => ({
	default: notificationToastMock,
}));

vi.mock('@/layouts/DashboardLayout', () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@components/common/Pagination', () => ({
	default: ({ currentPage }: { currentPage: number }) => <div>pagination:{currentPage}</div>,
}));

vi.mock('@components/feedback/Loader', () => ({
	default: ({ text }: { text?: string }) => <div>{text ?? 'loading'}</div>,
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

const renderNotificationsPage = () =>
	render(
		<MemoryRouter initialEntries={[ROUTES.NOTIFICATIONS]}>
			<Routes>
				<Route path={ROUTES.NOTIFICATIONS} element={<NotificationsPage />} />
				<Route
					path={ROUTES.TRAVELLER_BOOKING_DETAIL}
					element={<div>booking detail page</div>}
				/>
				<Route path={ROUTES.TRAVELLER_BOOKINGS} element={<div>bookings page</div>} />
			</Routes>
		</MemoryRouter>,
	);

const buildNotification = (
	overrides: Partial<NotificationItem> = {},
): NotificationItem => ({
	id: 1,
	notificationType: 'booking_confirmed',
	priority: 'normal',
	title: 'Booking confirmed',
	body: 'Your booking has been confirmed.',
	actionUrl: '',
	imageUrl: '',
	metadata: { bookingId: 55 },
	actorName: 'ConnectNepal',
	isRead: false,
	readAt: null,
	isArchived: false,
	createdAt: '2026-05-01T10:00:00Z',
	...overrides,
});

const buildPage = (
	overrides: Partial<PaginatedNotifications> = {},
): PaginatedNotifications => ({
	count: 1,
	next: null,
	previous: null,
	results: [buildNotification()],
	...overrides,
});

describe('Notifications page', () => {
	beforeEach(() => {
		useAuthMock.mockReset();
		useNotificationsMock.mockReset();
		notificationsServiceMock.list.mockReset();
		notificationToastMock.error.mockReset();

		useAuthMock.mockReturnValue({
			user: { role: 'traveller', email: 'traveller@example.com' },
		});
		useNotificationsMock.mockReturnValue({
			unreadCount: 2,
			markAsRead: vi.fn((id: number) =>
				Promise.resolve(
					buildNotification({
						id,
						isRead: true,
						readAt: '2026-05-01T11:00:00Z',
					}),
				),
			),
			markAllAsRead: vi.fn(() => Promise.resolve({ updated: 2, unreadCount: 0 })),
		});
	});

	it('renders notifications and opens the resolved target while marking unread items as read', async () => {
		notificationsServiceMock.list.mockResolvedValueOnce(buildPage());

		const user = userEvent.setup();
		const context = useNotificationsMock();
		renderNotificationsPage();

		expect(await screen.findByText('Booking confirmed')).toBeInTheDocument();
		expect(screen.getByText('1 total notifications')).toBeInTheDocument();
		expect(screen.getByText('2 unread')).toBeInTheDocument();

		await user.click(
			screen.getByRole('button', {
				name: /Booking confirmed.*Your booking has been confirmed\./i,
			}),
		);

		await waitFor(() => {
			expect(screen.getByText('booking detail page')).toBeInTheDocument();
		});

		expect(context.markAsRead).toHaveBeenCalledWith(1);
	});

	it('handles mark-all-read failures with a toast and shows an error retry state for list failures', async () => {
		notificationsServiceMock.list
			.mockRejectedValueOnce(new Error('Failed to load notifications'))
			.mockResolvedValueOnce(buildPage());

		const markAllAsRead = vi.fn(() =>
			Promise.reject(new Error('Failed to mark all notifications as read')),
		);
		useNotificationsMock.mockReturnValue({
			unreadCount: 3,
			markAsRead: vi.fn((id: number) =>
				Promise.resolve(buildNotification({ id, isRead: true })),
			),
			markAllAsRead,
		});

		const user = userEvent.setup();
		renderNotificationsPage();

		expect(await screen.findByText('Failed to load notifications')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Retry' }));
		expect(await screen.findByText('Booking confirmed')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Mark all read' }));

		expect(markAllAsRead).toHaveBeenCalledTimes(1);
		expect(notificationToastMock.error).toHaveBeenCalledWith(
			'Failed to mark all notifications as read',
		);
	});

	it('shows the empty state when there are no notifications', async () => {
		notificationsServiceMock.list.mockResolvedValueOnce(buildPage({ count: 0, results: [] }));

		renderNotificationsPage();

		expect(await screen.findByText('No notifications')).toBeInTheDocument();
		expect(
			screen.getByText('When bookings or reviews change, they will show here.'),
		).toBeInTheDocument();
	});
});
