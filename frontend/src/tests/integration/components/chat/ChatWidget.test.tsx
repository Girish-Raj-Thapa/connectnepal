import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatWidget from '@components/chatbot/ChatWidget';
import type { ChatMessage, ChatSessionDetail } from '@/types/chatbot';

type AuthContextMockValue = {
	user: { role: 'traveller' | 'host' | 'admin'; firstName?: string; email: string } | null;
};

type ChatContextMockValue = {
	messages: ChatMessage[];
	isOpen: boolean;
	isSending: boolean;
	sendMessage: (text: string) => Promise<void>;
	retryMessage: (messageId: string) => Promise<void>;
	closeChat: () => void;
	openChat: () => void;
	toggleChat: () => void;
	loadSession: (detail: ChatSessionDetail) => void;
	startNewChat: () => void;
	contextListingId: number | null;
	contextPackageId: number | null;
};

const useAuthMock = vi.hoisted(() => vi.fn<() => AuthContextMockValue>());
const useChatMock = vi.hoisted(() => vi.fn<() => ChatContextMockValue>());

vi.mock('@context/AuthContext', () => ({
	useAuth: useAuthMock,
}));

vi.mock('@context/ChatContext', () => ({
	useChat: useChatMock,
}));

const renderChatWidget = () =>
	render(
		<MemoryRouter>
			<ChatWidget />
		</MemoryRouter>,
	);

describe('Chat widget', () => {
	beforeEach(() => {
		Element.prototype.scrollIntoView = vi.fn();
		useAuthMock.mockReset();
		useChatMock.mockReset();
		useAuthMock.mockReturnValue({
			user: { role: 'traveller', firstName: 'Girish', email: 'traveller@example.com' },
		});
		useChatMock.mockReturnValue({
			messages: [],
			isOpen: false,
			isSending: false,
			sendMessage: vi.fn(async () => {}),
			retryMessage: vi.fn(async () => {}),
			closeChat: vi.fn(),
			openChat: vi.fn(),
			toggleChat: vi.fn(),
			loadSession: vi.fn(),
			startNewChat: vi.fn(),
			contextListingId: null,
			contextPackageId: null,
		});
	});

	it('hides the widget for host and admin users', () => {
		useAuthMock.mockReturnValue({
			user: { role: 'host', email: 'host@example.com' },
		});

		renderChatWidget();

		expect(screen.queryByRole('button', { name: /chat/i })).not.toBeInTheDocument();
	});

	it('toggles the widget open and renders the greeting state for travellers', async () => {
		const toggleChat = vi.fn();
		useChatMock.mockReturnValue({
			...useChatMock(),
			messages: [],
			isOpen: true,
			toggleChat,
		});

		const user = userEvent.setup();
		renderChatWidget();

		expect(screen.getByText('Hi Girish! Ask anything about travel in Nepal.')).toBeInTheDocument();

		await user.click(screen.getAllByRole('button', { name: 'Close chat' })[1]);

		expect(toggleChat).toHaveBeenCalledTimes(1);
	});

	it('sends a message, retries failed messages, and starts a new chat from the panel', async () => {
		const sendMessage = vi.fn(async () => {});
		const retryMessage = vi.fn(async () => {});
		const startNewChat = vi.fn();
		useChatMock.mockReturnValue({
			...useChatMock(),
			isOpen: true,
			sendMessage,
			retryMessage,
			startNewChat,
			contextListingId: 99,
			messages: [
				{
					id: 'failed-1',
					role: 'user',
					content: 'Need help',
					failed: true,
					createdAt: '2026-05-01T10:00:00Z',
				},
			],
		});

		const user = userEvent.setup();
		renderChatWidget();

		expect(screen.getByText('Asking about this listing')).toBeInTheDocument();

		await user.type(screen.getByPlaceholderText('Type your message...'), 'Hello bot');
		await user.click(screen.getByRole('button', { name: 'Send message' }));

		expect(sendMessage).toHaveBeenCalledWith('Hello bot');

		await user.click(screen.getByRole('button', { name: 'Retry' }));
		expect(retryMessage).toHaveBeenCalledWith('failed-1');

		await user.click(screen.getByRole('button', { name: 'New chat' }));
		expect(startNewChat).toHaveBeenCalledTimes(1);

		await waitFor(() => {
			expect(screen.getByText('Need help')).toBeInTheDocument();
		});
	});
});
