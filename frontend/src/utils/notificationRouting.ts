import { generatePath } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import type { UserRole } from '@/types/accounts';
import type { NotificationItem } from '@/types/notifications';

const getStringValue = (
	metadata: Record<string, unknown>,
	key: string,
): string | null => {
	const value = metadata[key];

	if (typeof value === 'number') return String(value);
	if (typeof value === 'string' && value.trim()) return value;

	return null;
};

const getDefaultNotificationsRoute = (role: UserRole) => {
	switch (role) {
		case 'traveller':
		case 'host':
		case 'admin':
			return ROUTES.NOTIFICATIONS;
		default:
			return ROUTES.HOME;
	}
};

export const resolveNotificationHref = (
	notification: NotificationItem,
	role: UserRole,
) => {
	switch (notification.notificationType) {
		case 'booking_confirmed':
		case 'booking_cancelled':
		case 'booking_expired': {
			const bookingId = getStringValue(notification.metadata, 'bookingId');
			return bookingId
				? generatePath(ROUTES.TRAVELLER_BOOKING_DETAIL, { id: bookingId })
				: ROUTES.TRAVELLER_BOOKINGS;
		}

		case 'booking_completed':
		case 'review_reply_received':
			return ROUTES.TRAVELLER_REVIEWS;

		case 'host_new_booking':
		case 'host_booking_cancelled':
			return ROUTES.HOST_BOOKINGS;

		case 'review_received':
			return ROUTES.HOST_REVIEWS;

		case 'trip_plan_item_removed': {
			const tripPlannerId = getStringValue(notification.metadata, 'tripPlannerId');
			return tripPlannerId
				? generatePath(ROUTES.TRAVELLER_TRIP_DETAIL, { id: tripPlannerId })
				: ROUTES.TRAVELLER_TRIPS;
		}

		default:
			return notification.actionUrl || getDefaultNotificationsRoute(role);
	}
};
