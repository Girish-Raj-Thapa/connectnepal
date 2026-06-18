import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@context/AuthContext';
import notificationsService from '@services/notifications.service';
import {
	buildNotificationsSocketUrl,
	normalizeSocketNotification,
	prependRecentNotification,
} from '@utils/notificationSocket';
import toastNotification from '@utils/notifications';
import type {
	MarkAllReadResponse,
	NotificationItem,
	NotificationsSocketMessage,
} from '@/types/notifications';

type NotificationsContextValue = {
	unreadCount: number;
	recentNotifications: NotificationItem[];
	recentLoading: boolean;
	refreshUnreadCount: () => Promise<void>;
	loadRecent: () => Promise<void>;
	markAsRead: (id: number) => Promise<NotificationItem>;
	markAllAsRead: () => Promise<MarkAllReadResponse>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
	null,
);

const replaceRecentNotification = (
	items: NotificationItem[],
	updated: NotificationItem,
) => items.map((item) => (item.id === updated.id ? updated : item));

export const NotificationsProvider = ({
	children,
}: {
	children: ReactNode;
}) => {
	const { isAuthenticated, accessToken } = useAuth();

	const [unreadCount, setUnreadCount] = useState(0);
	const [recentNotifications, setRecentNotifications] = useState<
		NotificationItem[]
	>([]);
	const [recentLoading, setRecentLoading] = useState(false);

	const socketRef = useRef<WebSocket | null>(null);
	const reconnectTimerRef = useRef<number | null>(null);
	const accessTokenRef = useRef<string | null>(null);

	useEffect(() => {
		accessTokenRef.current = accessToken;
	}, [accessToken]);

	const clearReconnectTimer = useCallback(() => {
		if (reconnectTimerRef.current !== null) {
			window.clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}
	}, []);

	const disconnectSocket = useCallback(() => {
		clearReconnectTimer();
		if (socketRef.current) {
			socketRef.current.onclose = null;
			socketRef.current.onmessage = null;
			socketRef.current.close();
			socketRef.current = null;
		}
	}, [clearReconnectTimer]);

	const resetState = useCallback(() => {
		setUnreadCount(0);
		setRecentNotifications([]);
		setRecentLoading(false);
	}, []);

	const refreshUnreadCount = useCallback(async () => {
		if (!isAuthenticated) return;
		const data = await notificationsService.getUnreadCount();
		setUnreadCount(data.unreadCount);
	}, [isAuthenticated]);

	const loadRecent = useCallback(async () => {
		if (!isAuthenticated) return;

		setRecentLoading(true);
		try {
			const data = await notificationsService.getRecent();
			setRecentNotifications(data);
		} finally {
			setRecentLoading(false);
		}
	}, [isAuthenticated]);

	const markAsRead = useCallback(async (id: number) => {
		const updated = await notificationsService.markAsRead(id);
		setRecentNotifications((prev) =>
			replaceRecentNotification(prev, updated),
		);
		void refreshUnreadCount().catch(() => undefined);
		return updated;
	}, [refreshUnreadCount]);

	const markAllAsRead = useCallback(async () => {
		const data = await notificationsService.markAllAsRead();
		setUnreadCount(data.unreadCount);
		void loadRecent().catch(() => undefined);
		return data;
	}, [loadRecent]);

	useEffect(() => {
		if (!isAuthenticated || !accessToken) {
			disconnectSocket();
			resetState();
			return;
		}

		let cancelled = false;

		void refreshUnreadCount().catch(() => undefined);

		const connect = (token: string) => {
			disconnectSocket();

			const socket = new WebSocket(buildNotificationsSocketUrl(token));
			socketRef.current = socket;

			socket.onmessage = (event) => {
				if (cancelled) return;
				if (typeof event.data !== 'string') return;

				try {
					const message = JSON.parse(event.data) as NotificationsSocketMessage;

					if (message.type === 'new_notification') {
						const incoming = normalizeSocketNotification(
							message.payload,
						);

						setUnreadCount((prev) => prev + 1);
						setRecentNotifications((prev) =>
							prependRecentNotification(prev, incoming),
						);

						toastNotification.info(incoming.title);
						return;
					}

					if (message.type === 'unread_count_sync') {
						setUnreadCount(message.payload.unread_count);
						void loadRecent().catch(() => undefined);
					}
				} catch (error) {
					if (import.meta.env.DEV) {
						console.error(
							'Failed to parse notifications socket message',
							error,
						);
					}
				}
			};

			socket.onclose = (event) => {
				if (cancelled) return;

				socketRef.current = null;

				if (event.code === 4401) {
					void refreshUnreadCount().catch(() => undefined);
					return;
				}

				clearReconnectTimer();
				reconnectTimerRef.current = window.setTimeout(() => {
					const latestToken = accessTokenRef.current;
					if (latestToken) {
						connect(latestToken);
					}
				}, 3000);
			};
		};

		connect(accessToken);

		return () => {
			cancelled = true;
			disconnectSocket();
		};
	}, [
		accessToken,
		clearReconnectTimer,
		disconnectSocket,
		isAuthenticated,
		loadRecent,
		refreshUnreadCount,
		resetState,
	]);

	useEffect(() => {
		if (!isAuthenticated) return;

		const handleFocus = () => {
			void refreshUnreadCount().catch(() => undefined);
		};

		window.addEventListener('focus', handleFocus);
		return () => window.removeEventListener('focus', handleFocus);
	}, [isAuthenticated, refreshUnreadCount]);

	const value: NotificationsContextValue = {
		unreadCount,
		recentNotifications,
		recentLoading,
		refreshUnreadCount,
		loadRecent,
		markAsRead,
		markAllAsRead,
	};

	return (
		<NotificationsContext.Provider value={value}>
			{children}
		</NotificationsContext.Provider>
	);
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => {
	const ctx = useContext(NotificationsContext);
	if (!ctx) {
		throw new Error(
			'useNotifications must be used within NotificationsProvider',
		);
	}
	return ctx;
};
