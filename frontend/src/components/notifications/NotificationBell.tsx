import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { useNotifications } from '@context/NotificationsContext';
import NotificationListItem from '@components/notifications/NotificationListItem';
import { ROUTES } from '@/constants/routes';
import { resolveNotificationHref } from '@utils/notificationRouting';
import toastNotification from '@utils/notifications';
import type { NotificationItem } from '@/types/notifications';

const NotificationBell = () => {
	const { user } = useAuth();
	const navigate = useNavigate();

	const {
		unreadCount,
		recentNotifications,
		recentLoading,
		loadRecent,
		markAsRead,
		markAllAsRead,
	} = useNotifications();

	const [open, setOpen] = useState(false);
	const wrapperRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		void loadRecent().catch(() => undefined);
	}, [open, loadRecent]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				wrapperRef.current &&
				!wrapperRef.current.contains(event.target as Node)
			) {
				setOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () =>
			document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setOpen(false);
			}
		};

		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, []);

	if (!user) return null;

	const handleOpenNotification = (item: NotificationItem) => {
		const target = resolveNotificationHref(item, user.role);

		setOpen(false);

		if (!item.isRead) {
			void markAsRead(item.id).catch(() => undefined);
		}

		void navigate(target);
	};

	const handleMarkAll = async () => {
		try {
			await markAllAsRead();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to mark notifications as read';
			toastNotification.error(message);
		}
	};

	const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

	return (
		<div className="relative" ref={wrapperRef}>
			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				className="relative rounded-full p-2 text-ink-muted transition hover:bg-surface-muted hover:text-ink focus:outline-none focus-ring"
				aria-label="Notifications"
				aria-expanded={open}
				aria-haspopup="true"
			>
				<Bell className="h-5 w-5" />
				{unreadCount > 0 && (
					<span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
						{badgeLabel}
					</span>
				)}
			</button>

			{open && (
				<div className="absolute right-0 mt-2 w-[28rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-3 shadow-xl z-50">
					<div className="mb-3 flex items-center justify-between px-1">
						<div>
							<p className="text-sm font-semibold text-ink">
								Notifications
							</p>
							<p className="text-xs text-ink-muted">
								{unreadCount} unread
							</p>
						</div>

						{unreadCount > 0 && (
							<button
								type="button"
								onClick={() => void handleMarkAll()}
								className="text-xs font-semibold text-teal-700 transition hover:text-teal-800"
							>
								Mark all read
							</button>
						)}
					</div>

					<div className="max-h-96 space-y-3 overflow-y-auto">
						{recentLoading && (
							<p className="py-6 text-center text-sm text-ink-muted">
								Loading notifications...
							</p>
						)}

						{!recentLoading && recentNotifications.length === 0 && (
							<div className="rounded-2xl border border-dashed border-line p-6 text-center">
								<p className="text-sm font-semibold text-ink-secondary">
									No notifications yet
								</p>
								<p className="mt-1 text-sm text-ink-muted">
									New activity will show up here.
								</p>
							</div>
						)}

						{!recentLoading &&
							recentNotifications.map((item) => (
								<NotificationListItem
									key={item.id}
									notification={item}
									compact
									onOpen={handleOpenNotification}
								/>
							))}
					</div>

					<div className="mt-3 border-t border-line-muted pt-3 text-center">
						<Link
							to={ROUTES.NOTIFICATIONS}
							onClick={() => setOpen(false)}
							className="text-sm font-semibold text-teal-700 transition hover:text-teal-800"
						>
							View all notifications
						</Link>
					</div>
				</div>
			)}
		</div>
	);
};

export default NotificationBell;
