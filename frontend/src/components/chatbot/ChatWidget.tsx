import { MessageCircle, X } from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import { useChat } from '@context/ChatContext';
import ChatPanel from './ChatPanel';

const ChatWidget = () => {
	const { user } = useAuth();
	const { isOpen, toggleChat } = useChat();

	// Hide for host and admin users
	if (user?.role === 'host' || user?.role === 'admin') return null;

	return (
		<>
			{isOpen && <ChatPanel />}

			{/* Floating action button */}
			<button
				type="button"
				onClick={toggleChat}
				className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-teal-600 to-teal-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
				aria-label={isOpen ? 'Close chat' : 'Open chat'}
			>
				<span
					className={`absolute transition-all duration-200 ${
						isOpen ? 'rotate-0 scale-100' : 'rotate-90 scale-0'
					}`}
				>
					<X className="w-6 h-6" />
				</span>
				<span
					className={`absolute transition-all duration-200 ${
						isOpen ? '-rotate-90 scale-0' : 'rotate-0 scale-100'
					}`}
				>
					<MessageCircle className="w-6 h-6" />
				</span>
			</button>
		</>
	);
};

export default ChatWidget;
