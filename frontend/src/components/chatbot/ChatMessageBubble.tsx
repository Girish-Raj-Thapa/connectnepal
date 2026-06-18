import { Bot, User } from 'lucide-react';
import type { ChatMessage } from '@/types/chatbot';

interface ChatMessageBubbleProps {
	message: ChatMessage;
	onRetry?: () => void;
}

const ChatMessageBubble = ({ message, onRetry }: ChatMessageBubbleProps) => {
	const isUser = message.role === 'user';

	return (
		<div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
			{/* Avatar */}
			<div
				className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
					isUser
						? 'bg-teal-600 text-white'
						: 'bg-surface-raised text-ink-muted'
				}`}
			>
				{isUser ? (
					<User className="w-3.5 h-3.5" />
				) : (
					<Bot className="w-3.5 h-3.5" />
				)}
			</div>

			{/* Bubble */}
			<div
				className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
					isUser
						? 'bg-teal-600 text-white rounded-br-md'
						: 'bg-surface-muted text-ink-secondary rounded-bl-md'
				} ${message.pending ? 'opacity-70' : ''} ${message.failed ? 'opacity-50' : ''}`}
			>
				<p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
				{message.failed && (
					<div className="mt-1.5 flex items-center gap-2">
						<p className="text-xs text-red-300 italic">Failed to send</p>
						{onRetry && (
							<button
								type="button"
								onClick={onRetry}
								className="text-xs text-red-200 underline hover:text-white transition"
							>
								Retry
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default ChatMessageBubble;
