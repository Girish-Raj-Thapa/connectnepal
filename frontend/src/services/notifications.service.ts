import api from '@services/api.service';
import { extractApiError } from '@utils/apiError';
import type {
	MarkAllReadResponse,
	NotificationItem,
	PaginatedNotifications,
	UnreadCountResponse,
} from '@/types/notifications';


const notificationsService = {
	list: async (page = 1): Promise<PaginatedNotifications> => {
		try {
			const res = await api.get<PaginatedNotifications>('/notifications/', {
				params: { page },
			});
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to load notifications');
		}
	},

	getRecent: async (): Promise<NotificationItem[]> => {
		try {
			const res = await api.get<NotificationItem[]>('/notifications/recent/');
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to load recent notifications');
		}
	},

	getUnreadCount: async (): Promise<UnreadCountResponse> => {
		try {
			const res = await api.get<UnreadCountResponse>(
				'/notifications/unread-count/',
			);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to load unread count');
		}
	},

	markAsRead: async (id: number): Promise<NotificationItem> => {
		try {
			const res = await api.post<NotificationItem>(
				`/notifications/${id}/mark-read/`,
			);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to mark notification as read');
		}
	},

	markAllAsRead: async (): Promise<MarkAllReadResponse> => {
		try {
			const res = await api.post<MarkAllReadResponse>(
				'/notifications/mark-all-read/',
			);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to mark all notifications as read');
		}
	},
};

export default notificationsService;
