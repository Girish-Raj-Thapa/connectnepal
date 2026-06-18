import type { PaginatedResponse } from '@/types/listings';

export type NotificationPriority = 'low' | 'normal' | 'high';

export type NotificationType = 'booking_confirmed' | 'host_new_booking' | 'booking_cancelled' | 'host_booking_cancelled' | 'booking_expired' | 'booking_completed' | 'review_received' | 'review_reply_received' | 'trip_plan_item_removed';

export interface NotificationItem {
    id: number;
    notificationType: NotificationType;
    priority: NotificationPriority;
    title: string;
    body: string;
    actionUrl: string;
    imageUrl: string;
    metadata: Record<string, unknown>;
    actorName: string | null;
    isRead: boolean;
    readAt: string | null;
    isArchived: boolean;
    createdAt: string;
}

export type PaginatedNotifications = PaginatedResponse<NotificationItem>;

export interface UnreadCountResponse {
    unreadCount: number;
}

export interface MarkAllReadResponse {
	updated: number;
	unreadCount: number;
}

export interface RawSocketNotification {
	id: number;
	notification_type: NotificationType;
	priority: NotificationPriority;
	title: string;
	body: string;
	action_url?: string;
	image_url?: string;
	metadata?: Record<string, unknown>;
	actor_name?: string | null;
	is_read?: boolean;
	read_at?: string | null;
	is_archived?: boolean;
	created_at: string;
}

export type NotificationsSocketMessage =
	| {
			type: 'new_notification';
			payload: RawSocketNotification;
	  }
	| {
			type: 'unread_count_sync';
			payload: { unread_count: number };
	  };
      
