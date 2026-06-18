import { useState, useRef, useEffect } from 'react';
import { X, Send, SquarePen, Bot } from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import { useChat } from '@context/ChatContext';
import ChatMessageBubble from './ChatMessageBubble';

const TypingIndicator = () => (
	<div className="flex gap-2.5">
		<div className="shrink-0 w-7 h-7 rounded-full bg-surface-raised text-ink-muted flex items-center justify-center">
			<Bot className="w-3.5 h-3.5" />
		</div>
		<div className="bg-surface-muted rounded-2xl rounded-bl-md px-4 py-3">
			<div className="flex gap-1">
				<span className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce [animation-delay:-0.3s]" />
				<span className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce [animation-delay:-0.15s]" />
				<span className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce" />
			</div>
		</div>
	</div>
);

const ChatPanel = () => {
	const { user } = useAuth();
	const {
		messages,
		isSending,
		sendMessage,
		retryMessage,
		closeChat,
		startNewChat,
		contextListingId,
		contextPackageId,
	} = useChat();

	const [input, setInput] = useState('');
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Auto-scroll to bottom on new messages
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages.length, isSending]);

	// Focus input on mount
	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isSending) return;
		void sendMessage(input);
		setInput('');
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	};

	// Build contextual subtitle
	let subtitle = '';
	if (contextListingId) subtitle = 'Asking about this listing';
	else if (contextPackageId) subtitle = 'Asking about this package';

	// Empty state greeting
	const greeting = user?.firstName
		? `Hi ${user.firstName}! Ask anything about travel in Nepal.`
		: 'Hi! Ask anything about bookings, listings, packages, or travel in Nepal.';

	return (
		<div className="fixed bottom-20 right-4 sm:right-6 z-50 w-95 max-w-[calc(100vw-2rem)] h-130 max-h-[calc(100vh-8rem)] bg-surface rounded-2xl shadow-2xl border border-line flex flex-col overflow-hidden animate-in">
			{/* ── Header ── */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-line-muted bg-linear-to-r from-teal-600 to-teal-500">
				<div className="flex items-center gap-2.5">
					<div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
						<Bot className="w-4.5 h-4.5 text-white" />
					</div>
					<div>
						<h3 className="text-sm font-semibold text-white">
							ConnectNepal Assistant
						</h3>
						{subtitle && (
							<p className="text-xs text-teal-100">{subtitle}</p>
						)}
					</div>
				</div>

				<div className="flex items-center gap-1">
					{messages.length > 0 && (
						<button
							type="button"
							onClick={startNewChat}
							className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
							aria-label="New chat"
							title="New chat"
						>
							<SquarePen className="w-4 h-4" />
						</button>
					)}
					<button
						type="button"
						onClick={closeChat}
						className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
						aria-label="Close chat"
					>
						<X className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* ── Messages ── */}
			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
				{messages.length === 0 && !isSending && (
					<div className="flex flex-col items-center justify-center h-full text-center px-4">
						<div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mb-3">
							<Bot className="w-6 h-6 text-teal-600" />
						</div>
						<p className="text-sm text-ink-muted leading-relaxed">
							{greeting}
						</p>
					</div>
				)}

				{messages.map((msg) => (
					<ChatMessageBubble
						key={msg.id}
						message={msg}
						onRetry={msg.failed ? () => void retryMessage(msg.id) : undefined}
					/>
				))}

				{isSending && <TypingIndicator />}

				<div ref={messagesEndRef} />
			</div>

			{/* ── Input ── */}
			<form
				onSubmit={handleSubmit}
				className="flex items-center gap-2 px-3 py-3 border-t border-line-muted bg-surface-muted/50"
			>
				<input
					ref={inputRef}
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Type your message..."
					maxLength={2000}
					disabled={isSending}
					className="flex-1 px-3.5 py-2.5 text-sm bg-surface border border-line rounded-xl focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 disabled:opacity-50 placeholder:text-ink-muted"
				/>
				<button
					type="submit"
					disabled={!input.trim() || isSending}
					className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
					aria-label="Send message"
				>
					<Send className="w-4 h-4" />
				</button>
			</form>
		</div>
	);
};

export default ChatPanel;
