import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatHistory from '@pages/traveller/chat/ChatHistory';
import type { ChatSessionDetail, PaginatedChatSessions } from '@/types/chatbot';

type ChatContextMockValue = {
	loadSession: (detail: ChatSessionDetail) => void;
	openChat: () => void;
};

const useChatMock = vi.hoisted(() => vi.fn<() => ChatContextMockValue>());
const chatbotServiceMock = vi.hoisted(() => ({
	listSessions: vi.fn(),
	getSessionDetail: vi.fn(),
}));
const notificationToastMock = vi.hoisted(() => ({
	error: vi.fn(),
	success: vi.fn(),
	info: vi.fn(),
}));

vi.mock('@context/ChatContext', () => ({
	useChat: useChatMock,
}));

vi.mock('@services/chatbot.service', () => ({
	default: chatbotServiceMock,
}));

vi.mock('@utils/notifications', () => ({
	default: notificationToastMock,
}));

vi.mock('@/layouts/DashboardLayout', () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@components/feedback/Loader', () => ({
	default: ({ text }: { text?: string }) => <div>{text ?? 'loading'}</div>,
}));

vi.mock('@components/common/Pagination', () => ({
	default: ({ currentPage }: { currentPage: number }) => <div>pagination:{currentPage}</div>,
}));

const renderChatHistory = () =>
	render(
		<MemoryRouter>
			<ChatHistory />
		</MemoryRouter>,
	);

const buildSessionsPage = (
	overrides: Partial<PaginatedChatSessions> = {},
): PaginatedChatSessions => ({
	count: 2,
	next: null,
	previous: null,
	results: [
		{
			id: 10,
			title: 'Booking help',
			createdAt: '2026-05-01T10:00:00Z',
			updatedAt: '2026-05-01T10:05:00Z',
			messageCount: 3,
		},
		{
			id: 11,
			title: 'Trip ideas',
			createdAt: '2026-05-02T10:00:00Z',
			updatedAt: '2026-05-02T10:05:00Z',
			messageCount: 5,
		},
	],
	...overrides,
});

const buildSessionDetail = (): ChatSessionDetail => ({
	id: 10,
	title: 'Booking help',
	createdAt: '2026-05-01T10:00:00Z',
	messages: [
		{
			role: 'user',
			content: 'How do I book?',
			intent: 'booking_info',
			createdAt: '2026-05-01T10:01:00Z',
		},
	],
});

describe('Chat history page', () => {
	beforeEach(() => {
		useChatMock.mockReset();
		chatbotServiceMock.listSessions.mockReset();
		chatbotServiceMock.getSessionDetail.mockReset();
		notificationToastMock.error.mockReset();

		useChatMock.mockReturnValue({
			loadSession: vi.fn(),
			openChat: vi.fn(),
		});
	});

	it('renders chat sessions and opens a session in the chat widget', async () => {
		chatbotServiceMock.listSessions.mockResolvedValueOnce(buildSessionsPage());
		chatbotServiceMock.getSessionDetail.mockResolvedValueOnce(buildSessionDetail());

		const context = useChatMock();
		const user = userEvent.setup();
		renderChatHistory();

		expect(await screen.findByText('Booking help')).toBeInTheDocument();
		expect(screen.getByText('pagination:1')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /Booking help/i }));

		await waitFor(() => {
			expect(context.loadSession).toHaveBeenCalledWith(buildSessionDetail());
		});
		expect(context.openChat).toHaveBeenCalledTimes(1);
	});

	it('shows the empty state and toasts when loading a session detail fails', async () => {
		chatbotServiceMock.listSessions.mockResolvedValueOnce(buildSessionsPage({ count: 0, results: [] }));

		renderChatHistory();

		expect(await screen.findByText('No chat history yet')).toBeInTheDocument();

		chatbotServiceMock.listSessions.mockResolvedValueOnce(buildSessionsPage());
		chatbotServiceMock.getSessionDetail.mockRejectedValueOnce(
			new Error('Failed to load chat session'),
		);

		const context = useChatMock();
		const user = userEvent.setup();
		renderChatHistory();

		await user.click(await screen.findByRole('button', { name: /Booking help/i }));

		expect(notificationToastMock.error).toHaveBeenCalledWith('Failed to load chat session');
		expect(context.openChat).not.toHaveBeenCalled();
	});
});
