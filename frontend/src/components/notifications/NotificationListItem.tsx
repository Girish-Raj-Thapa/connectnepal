import {
	Bell,
	CalendarCheck2,
	CalendarClock,
	CalendarX2,
	MessageSquareReply,
	Star,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { timeAgo } from '@utils/format';
import type {
	NotificationItem,
	NotificationType,
} from '@/types/notifications';

type NotificationListItemProps = {
	notification: NotificationItem;
	compact?: boolean;
	onOpen: (notification: NotificationItem) => void;
};

const getNotificationPresentation = (
	type: NotificationType,
): {
	icon: LucideIcon;
	iconClassName: string;
	label: string;
} => {
	switch (type) {
		case 'booking_confirmed':
		case 'host_new_booking':
			return {
				icon: CalendarCheck2,
				iconClassName: 'bg-emerald-50 text-emerald-600',
				label: 'Booking',
			};

		case 'booking_cancelled':
		case 'host_booking_cancelled':
			return {
				icon: CalendarX2,
				iconClassName: 'bg-red-50 text-red-600',
				label: 'Cancelled',
			};

		case 'booking_expired':
		case 'booking_completed':
			return {
				icon: CalendarClock,
				iconClassName: 'bg-amber-50 text-amber-600',
				label: 'Trip',
			};

		case 'review_received':
			return {
				icon: Star,
				iconClassName: 'bg-blue-50 text-blue-600',
				label: 'Review',
			};

		case 'review_reply_received':
			return {
				icon: MessageSquareReply,
				iconClassName: 'bg-blue-50 text-blue-600',
				label: 'Review',
			};

		default:
			return {
				icon: Bell,
				iconClassName: 'bg-surface-muted text-ink-secondary',
				label: 'Notification',
			};
	}
};

const NotificationListItem = ({
	notification,
	compact = false,
	onOpen,
}: NotificationListItemProps) => {
	const { icon: Icon, iconClassName, label } = getNotificationPresentation(
		notification.notificationType,
	);
	const containerClasses = compact ? 'rounded-xl p-2.5 gap-2.5' : 'rounded-2xl p-4 gap-3';
	const iconWrapperClasses = compact
		? 'h-8 w-8 rounded-lg'
		: 'h-10 w-10 rounded-xl';
	const iconClasses = compact ? 'h-4 w-4' : 'h-5 w-5';
	const metaClasses = compact
		? 'text-[11px] tracking-wide'
		: 'text-xs tracking-wide';
	const titleClasses = compact
		? 'mt-0.5 text-[15px] leading-6 line-clamp-1'
		: 'mt-1 text-[17px] leading-7';
	const bodyClasses = compact
		? 'mt-1 text-[13px] leading-5 text-ink-muted line-clamp-2'
		: 'mt-1 text-sm leading-6 text-ink-muted';

	return (
		<div
			className={`group flex items-start gap-3 rounded-2xl border ${
				notification.isRead
					? 'border-line bg-surface'
					: 'border-teal-100 bg-teal-50/70'
			} ${containerClasses}`}
		>
			{notification.imageUrl ? (
				<img
					src={notification.imageUrl}
					alt={notification.title}
					className={`${iconWrapperClasses} object-cover shrink-0`}
				/>
			) : (
				<div
					className={`flex shrink-0 items-center justify-center ${iconWrapperClasses} ${iconClassName}`}
				>
					<Icon className={iconClasses} />
				</div>
			)}

			<button
				type="button"
				onClick={() => onOpen(notification)}
				className="min-w-0 flex-1 text-left"
			>
				<div className="flex items-center gap-2">
					{!notification.isRead && (
						<span className={`${compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} rounded-full bg-teal-500 shrink-0`} />
					)}
					<span className={`font-semibold uppercase text-ink-muted ${metaClasses}`}>
						{label}
					</span>
					<span className={`${metaClasses} text-ink-muted`}>
						{timeAgo(notification.createdAt)}
					</span>
				</div>

				<p
					className={`${titleClasses} ${
						notification.isRead
							? 'font-semibold text-ink-secondary'
							: 'font-bold text-ink'
					}`}
				>
					{notification.title}
				</p>

				<p className={bodyClasses}>
					{notification.body}
				</p>

				{notification.actorName && !compact && (
					<p className="mt-2 text-xs font-medium text-ink-muted">
						By {notification.actorName}
					</p>
				)}
			</button>
		</div>
	);
};

export default NotificationListItem;
