import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Bell, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import Pagination from '@components/common/Pagination';
import Loader from '@components/feedback/Loader';
import TableActionIcon from '@components/common/TableActionIcon';
import { useAuth } from '@context/AuthContext';
import { useNotifications } from '@context/NotificationsContext';
import notificationsService from '@services/notifications.service';
import { resolveNotificationHref } from '@utils/notificationRouting';
import toastNotification from '@utils/notifications';
import type { NotificationItem } from '@/types/notifications';
import { formatDate, timeAgo } from '@utils/format';

const NOTIFICATION_TYPE_LABELS: Record<NotificationItem['notificationType'], string> = {
	booking_confirmed: 'Booking',
	host_new_booking: 'Booking',
	booking_cancelled: 'Cancelled',
	host_booking_cancelled: 'Cancelled',
	booking_expired: 'Expired',
	booking_completed: 'Completed',
	review_received: 'Review',
	review_reply_received: 'Review',
	trip_plan_item_removed: 'Trip Plan',
};

const NOTIFICATION_TYPE_BADGES: Record<NotificationItem['notificationType'], string> = {
	booking_confirmed: 'bg-emerald-50 text-emerald-700',
	host_new_booking: 'bg-emerald-50 text-emerald-700',
	booking_cancelled: 'bg-red-50 text-red-700',
	host_booking_cancelled: 'bg-red-50 text-red-700',
	booking_expired: 'bg-amber-50 text-amber-700',
	booking_completed: 'bg-blue-50 text-blue-700',
	review_received: 'bg-indigo-50 text-indigo-700',
	review_reply_received: 'bg-indigo-50 text-indigo-700',
	trip_plan_item_removed: 'bg-amber-50 text-amber-700',
};

const NotificationsPage = () => {
	const { user } = useAuth();
	const navigate = useNavigate();

	const {
		unreadCount,
		markAsRead,
		markAllAsRead,
	} = useNotifications();

	const [notifications, setNotifications] = useState<NotificationItem[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const fetchIdRef = useRef(0);

	const fetchNotifications = useCallback(async () => {
		const requestId = ++fetchIdRef.current;

		setLoading(true);
		setError('');

		try {
			const data = await notificationsService.list(page);

			if (requestId !== fetchIdRef.current) return;

			setNotifications(data.results);
			setTotalCount(data.count);
		} catch (error) {
			if (requestId !== fetchIdRef.current) return;

			const message =
				error instanceof Error
					? error.message
					: 'Failed to load notifications';
			setError(message);
		} finally {
			if (requestId === fetchIdRef.current) {
				setLoading(false);
			}
		}
	}, [page]);

	useEffect(() => {
		void fetchNotifications();
	}, [fetchNotifications]);

	if (!user) return null;

	const handleOpenNotification = (item: NotificationItem) => {
		const target = resolveNotificationHref(item, user.role);

		if (!item.isRead) {
			void markAsRead(item.id)
				.then((updated) => {
					setNotifications((prev) =>
						prev.map((notification) =>
							notification.id === updated.id
								? updated
								: notification,
						),
					);
				})
				.catch(() => undefined);
		}

		void navigate(target);
	};

	const handleMarkAllRead = async () => {
		try {
			await markAllAsRead();
			await fetchNotifications();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to mark all notifications as read';
			toastNotification.error(message);
		}
	};

	const renderTypeBadge = (item: NotificationItem) => (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${NOTIFICATION_TYPE_BADGES[item.notificationType]}`}
		>
			{NOTIFICATION_TYPE_LABELS[item.notificationType]}
		</span>
	);

	const renderReadStatus = (item: NotificationItem) => (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
				item.isRead
					? 'bg-surface-muted text-ink-secondary'
					: 'bg-teal-50 text-teal-700'
			}`}
		>
			{item.isRead ? 'Read' : 'Unread'}
		</span>
	);

	return (
		<DashboardLayout>
			<div className="bg-surface border-b border-line-muted -mx-6 -mt-6 lg:-mx-8 lg:-mt-8 px-6 lg:px-8 mb-8">
				<div className="py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div>
						<h1 className="page-heading text-ink">Notifications</h1>
						<p className="page-subtext mt-1">
							Review recent activity across your account
						</p>
					</div>

					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							onClick={() => void handleMarkAllRead()}
							disabled={unreadCount === 0}
							className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink-secondary transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
						>
							Mark all read
						</button>
					</div>
				</div>
			</div>

			{loading && (
				<div className="flex justify-center py-20">
					<Loader text="Loading notifications..." />
				</div>
			)}

			{!loading && error && (
				<div className="flex flex-col items-center gap-4 py-16">
					<AlertCircle className="h-12 w-12 text-red-400" />
					<p className="text-ink-muted">{error}</p>
					<button
						type="button"
						onClick={() => void fetchNotifications()}
						className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
					>
						Retry
					</button>
				</div>
			)}

			{!loading && !error && notifications.length === 0 && (
				<div className="rounded-3xl border border-dashed border-line bg-surface py-16 text-center">
					<Bell className="mx-auto h-16 w-16 text-line" />
					<h3 className="mt-4 text-xl font-semibold text-ink-secondary">
						No notifications
					</h3>
					<p className="mt-2 text-ink-muted">
						When bookings or reviews change, they will show here.
					</p>
				</div>
			)}

			{!loading && !error && notifications.length > 0 && (
				<div className="space-y-4">
					<div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-sm">
						<div className="flex items-center justify-between border-b border-line-muted px-5 py-4">
							<p className="text-sm text-ink-muted">
								{totalCount} total notifications
							</p>
							<p className="text-sm font-semibold text-teal-700">
								{unreadCount} unread
							</p>
						</div>

						<div className="overflow-x-auto">
							<table className="w-full min-w-220">
								<thead>
									<tr className="bg-surface-muted border-b border-line">
										{['Type', 'Notification', 'From', 'Received', 'Status', 'Actions'].map((header) => (
											<th
												key={header}
												className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted whitespace-nowrap"
											>
												{header}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y divide-line-muted">
									{notifications.map((item) => (
										<tr
											key={item.id}
											className={`transition-colors hover:bg-surface-muted ${
												item.isRead ? 'bg-surface' : 'bg-teal-50/40'
											}`}
										>
											<td className="px-5 py-4 align-top">
												{renderTypeBadge(item)}
											</td>
											<td className="px-5 py-4 align-top">
												<button
													type="button"
													onClick={() => handleOpenNotification(item)}
													className="max-w-md text-left"
												>
													<p
														className={`text-sm ${
															item.isRead
																? 'font-semibold text-ink-secondary'
																: 'font-bold text-ink'
														}`}
													>
														{item.title}
													</p>
													<p
														className="mt-1 text-sm text-ink-muted line-clamp-2"
														title={item.body}
													>
														{item.body}
													</p>
												</button>
											</td>
											<td className="px-5 py-4 align-top">
												<span className="text-sm text-ink-secondary">
													{item.actorName ?? 'System'}
												</span>
											</td>
											<td className="px-5 py-4 align-top">
												<div className="min-w-32">
													<p className="text-sm text-ink-secondary">
														{timeAgo(item.createdAt)}
													</p>
													<p className="mt-1 text-xs text-ink-muted">
														{formatDate(item.createdAt)}
													</p>
												</div>
											</td>
											<td className="px-5 py-4 align-top">
												{renderReadStatus(item)}
											</td>
											<td className="px-5 py-4 align-top">
												<div className="flex items-center gap-2">
													<TableActionIcon
														label={`Open notification ${item.title}`}
														tooltip="Open"
														onClick={() => handleOpenNotification(item)}
														icon={<Eye className="h-4 w-4" />}
														size="sm"
													/>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>

					<Pagination
						currentPage={page}
						totalCount={totalCount}
						pageSize={20}
						onPageChange={setPage}
					/>
				</div>
			)}
		</DashboardLayout>
	);
};

export default NotificationsPage;
