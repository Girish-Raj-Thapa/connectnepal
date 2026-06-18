import type { NotificationItem, RawSocketNotification } from '@/types/notifications';

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const buildNotificationsSocketUrl = (accessToken: string) => {
	const apiBase = stripTrailingSlash(String(import.meta.env.VITE_API_URL ?? ''));

	if (!apiBase) {
		throw new Error('VITE_API_URL is not configured');
	}

	const serverBase = apiBase.replace(/\/api$/, '');
	const wsBase = serverBase
		.replace(/^http:/, 'ws:')
		.replace(/^https:/, 'wss:');

	return `${wsBase}/ws/notifications/?token=${encodeURIComponent(accessToken)}`;
};

export const normalizeSocketNotification = (
	raw: RawSocketNotification,
): NotificationItem => ({
	id: raw.id,
	notificationType: raw.notification_type,
	priority: raw.priority,
	title: raw.title,
	body: raw.body,
	actionUrl: raw.action_url ?? '',
	imageUrl: raw.image_url ?? '',
	metadata: raw.metadata ?? {},
	actorName: raw.actor_name ?? null,
	isRead: raw.is_read ?? false,
	readAt: raw.read_at ?? null,
	isArchived: raw.is_archived ?? false,
	createdAt: raw.created_at,
});

export const prependRecentNotification = (
	items: NotificationItem[],
	incoming: NotificationItem,
) => {
	const deduped = items.filter((item) => item.id !== incoming.id);
	return [incoming, ...deduped].slice(0, 5);
};
