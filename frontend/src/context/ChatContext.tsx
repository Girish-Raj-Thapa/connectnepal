import {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect,
	useRef,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@context/AuthContext';
import chatbotService from '@services/chatbot.service';
import notification from '@utils/notifications';
import type { ChatMessage, ChatSessionDetail } from '@/types/chatbot';

// ─── localStorage keys ──────────────────────────────────────
const STORAGE_KEYS = {
	guestUuid: 'chatbot_guest_session_id',
	guestChatSession: 'chatbot_session_id',
	guestMessages: 'chatbot_guest_messages',
	authSession: 'chatbot_auth_session_id',
} as const;

// ─── Context value type ─────────────────────────────────────
interface ChatContextValue {
	messages: ChatMessage[];
	isOpen: boolean;
	isSending: boolean;
	contextListingId: number | null;
	contextPackageId: number | null;
	sendMessage: (text: string) => Promise<void>;
	retryMessage: (messageId: string) => Promise<void>;
	setContext: (opts: { listingId?: number | null; packageId?: number | null }) => void;
	openChat: (opts?: { listingId?: number; packageId?: number }) => void;
	closeChat: () => void;
	toggleChat: () => void;
	loadSession: (detail: ChatSessionDetail) => void;
	startNewChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ─── Helpers ────────────────────────────────────────────────
function createGuestUuid(): string {
	const uuid = crypto.randomUUID();
	localStorage.setItem(STORAGE_KEYS.guestUuid, uuid);
	return uuid;
}

function getOrCreateGuestUuid(): string {
	return localStorage.getItem(STORAGE_KEYS.guestUuid) ?? createGuestUuid();
}

function loadStoredNumber(key: string): number | null {
	const raw = localStorage.getItem(key);
	if (!raw) return null;
	const parsed = Number(raw);
	return Number.isNaN(parsed) ? null : parsed;
}

function loadGuestMessages(): ChatMessage[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.guestMessages);
		return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
	} catch {
		return [];
	}
}

function clearGuestCache() {
	localStorage.removeItem(STORAGE_KEYS.guestMessages);
	localStorage.removeItem(STORAGE_KEYS.guestChatSession);
}

function clearAuthCache() {
	localStorage.removeItem(STORAGE_KEYS.authSession);
}

// ─── Provider ───────────────────────────────────────────────
export const ChatProvider = ({ children }: { children: ReactNode }) => {
	const { isAuthenticated } = useAuth();

	const guestUuidRef = useRef(getOrCreateGuestUuid());
	const wasAuthenticatedRef = useRef(isAuthenticated);
	const requestGenerationRef = useRef(0);

	const [messages, setMessages] = useState<ChatMessage[]>(() =>
		isAuthenticated ? [] : loadGuestMessages(),
	);

	// Guest backend session ID — persisted in localStorage for reload continuity
	const [guestChatSessionId, setGuestChatSessionId] = useState<number | null>(
		() => (isAuthenticated ? null : loadStoredNumber(STORAGE_KEYS.guestChatSession)),
	);

	// Auth backend session ID — persisted in localStorage so reload continues the session
	const [authChatSessionId, setAuthChatSessionId] = useState<number | null>(
		() => (isAuthenticated ? loadStoredNumber(STORAGE_KEYS.authSession) : null),
	);

	const [isOpen, setIsOpen] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [contextListingId, setContextListingId] = useState<number | null>(null);
	const [contextPackageId, setContextPackageId] = useState<number | null>(null);

	const resetChatState = useCallback((options?: { close?: boolean }) => {
		requestGenerationRef.current += 1;
		setMessages([]);
		setGuestChatSessionId(null);
		setAuthChatSessionId(null);
		setIsSending(false);
		setContextListingId(null);
		setContextPackageId(null);
		if (options?.close) {
			setIsOpen(false);
		}
	}, []);

	// ── Persist guest state to localStorage ────────────────
	useEffect(() => {
		if (isAuthenticated) return;
		if (messages.length === 0) {
			localStorage.removeItem(STORAGE_KEYS.guestMessages);
			return;
		}
		localStorage.setItem(STORAGE_KEYS.guestMessages, JSON.stringify(messages));
	}, [messages, isAuthenticated]);

	useEffect(() => {
		if (isAuthenticated) return;
		if (guestChatSessionId !== null) {
			localStorage.setItem(STORAGE_KEYS.guestChatSession, String(guestChatSessionId));
		} else {
			localStorage.removeItem(STORAGE_KEYS.guestChatSession);
		}
	}, [guestChatSessionId, isAuthenticated]);

	// ── Persist auth session to localStorage ───────────────
	useEffect(() => {
		if (!isAuthenticated) return;
		if (authChatSessionId !== null) {
			localStorage.setItem(STORAGE_KEYS.authSession, String(authChatSessionId));
		} else {
			localStorage.removeItem(STORAGE_KEYS.authSession);
		}
	}, [authChatSessionId, isAuthenticated]);

	// ── Handle login / logout transitions ──────────────────
	// On login:  clear guest localStorage but keep in-memory guestChatSessionId
	//            so the first authenticated message can claim the guest session.
	// On logout: fully reset state, clear both caches, issue a new guest UUID.
	useEffect(() => {
		const wasAuthenticated = wasAuthenticatedRef.current;
		if (isAuthenticated === wasAuthenticated) return;

		if (isAuthenticated) {
			// Load any previously persisted auth session on login
			const persisted = loadStoredNumber(STORAGE_KEYS.authSession);
			if (persisted !== null) {
				setAuthChatSessionId(persisted);
				setGuestChatSessionId(null);
			}
			clearGuestCache();
		} else {
			resetChatState({ close: true });
			clearAuthCache();
			clearGuestCache();
			guestUuidRef.current = createGuestUuid();
		}

		wasAuthenticatedRef.current = isAuthenticated;
	}, [isAuthenticated, resetChatState]);

	const sendMessage = useCallback(
		async (text: string) => {
			const trimmed = text.trim();
			if (!trimmed || isSending) return;
			const requestGeneration = requestGenerationRef.current;

			// When authenticated, fall back to guestChatSessionId for the
			// first post-login message so the backend can claim the guest session.
			const activeSessionId = isAuthenticated
				? (authChatSessionId ?? guestChatSessionId)
				: guestChatSessionId;

			const userMsg: ChatMessage = {
				id: crypto.randomUUID(),
				role: 'user',
				content: trimmed,
				createdAt: new Date().toISOString(),
				pending: true,
			};

			setMessages((prev) => [...prev, userMsg]);
			setIsSending(true);

			try {
				const res = await chatbotService.sendMessage({
					message: trimmed,
					sessionId: activeSessionId,
					guestSessionId: isAuthenticated ? undefined : guestUuidRef.current,
					listingId: contextListingId,
					packageId: contextPackageId,
				});

				if (requestGeneration !== requestGenerationRef.current) return;

				const assistantMsg: ChatMessage = {
					id: crypto.randomUUID(),
					role: 'assistant',
					content: res.reply,
					intent: res.intent,
					createdAt: new Date().toISOString(),
				};

				setMessages((prev) =>
					prev.map((m) =>
						m.id === userMsg.id ? { ...m, pending: false } : m,
					).concat(assistantMsg),
				);

				if (isAuthenticated) {
					setAuthChatSessionId(res.sessionId);
					// Guest session has been claimed — no longer needed
					setGuestChatSessionId(null);
				} else {
					setGuestChatSessionId(res.sessionId);
				}
			} catch (error) {
				if (requestGeneration !== requestGenerationRef.current) return;

				const message =
					error instanceof Error ? error.message : 'Failed to send message';
				notification.error(message);

				setMessages((prev) =>
					prev.map((m) =>
						m.id === userMsg.id
							? { ...m, pending: false, failed: true }
							: m,
					),
				);
			} finally {
				if (requestGeneration === requestGenerationRef.current) {
					setIsSending(false);
				}
			}
		},
		[isSending, authChatSessionId, guestChatSessionId, isAuthenticated, contextListingId, contextPackageId],
	);

	const setContext = useCallback(
		(opts: { listingId?: number | null; packageId?: number | null }) => {
			if (opts.listingId !== undefined) setContextListingId(opts.listingId);
			if (opts.packageId !== undefined) setContextPackageId(opts.packageId);
		},
		[],
	);

	const openChat = useCallback(
		(opts?: { listingId?: number; packageId?: number }) => {
			if (opts?.listingId) setContextListingId(opts.listingId);
			if (opts?.packageId) setContextPackageId(opts.packageId);
			setIsOpen(true);
		},
		[],
	);

	const closeChat = useCallback(() => setIsOpen(false), []);
	const toggleChat = useCallback(() => setIsOpen((prev) => !prev), []);

	const loadSession = useCallback((detail: ChatSessionDetail) => {
		const loaded: ChatMessage[] = detail.messages.map((m, i) => ({
			id: `history-${detail.id}-${i}`,
			role: m.role,
			content: m.content,
			intent: m.intent || undefined,
			createdAt: m.createdAt,
		}));

		setMessages(loaded);
		setAuthChatSessionId(detail.id);
		setContextListingId(null);
		setContextPackageId(null);
	}, []);

	const retryMessage = useCallback(
		async (messageId: string) => {
			const failed = messages.find((m) => m.id === messageId);
			if (!failed) return;
			setMessages((prev) => prev.filter((m) => m.id !== messageId));
			await sendMessage(failed.content);
		},
		[messages, sendMessage],
	);

	const startNewChat = useCallback(() => {
		resetChatState();
	}, [resetChatState]);

	const value: ChatContextValue = {
		messages,
		isOpen,
		isSending,
		contextListingId,
		contextPackageId,
		sendMessage,
		retryMessage,
		setContext,
		openChat,
		closeChat,
		toggleChat,
		loadSession,
		startNewChat,
	};

	return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useChat = () => {
	const ctx = useContext(ChatContext);
	if (!ctx) throw new Error('useChat must be used within ChatProvider');
	return ctx;
};
