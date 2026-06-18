import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import Loader from '@components/feedback/Loader';
import Pagination from '@components/common/Pagination';
import { useChat } from '@context/ChatContext';
import chatbotService from '@services/chatbot.service';
import notification from '@utils/notifications';
import { timeAgo } from '@utils/format';
import type { ChatSessionSummary } from '@/types/chatbot';

const PAGE_SIZE = 20;

const ChatHistory = () => {
	const { loadSession, openChat } = useChat();

	const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [loadingSessionId, setLoadingSessionId] = useState<number | null>(null);

	const fetchIdRef = useRef(0);

	const fetchSessions = useCallback(async () => {
		const currentFetchId = ++fetchIdRef.current;
		try {
			setLoading(true);
			const data = await chatbotService.listSessions(page);
			if (currentFetchId !== fetchIdRef.current) return;
			setSessions(data.results);
			setTotalCount(data.count);
		} catch (error) {
			if (currentFetchId !== fetchIdRef.current) return;
			const message =
				error instanceof Error ? error.message : 'Failed to load chat history';
			notification.error(message);
		} finally {
			if (currentFetchId === fetchIdRef.current) {
				setLoading(false);
			}
		}
	}, [page]);

	useEffect(() => {
		void fetchSessions();
	}, [fetchSessions]);

	const handleOpenSession = async (sessionId: number) => {
		try {
			setLoadingSessionId(sessionId);
			const detail = await chatbotService.getSessionDetail(sessionId);
			loadSession(detail);
			openChat();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Failed to load conversation';
			notification.error(message);
		} finally {
			setLoadingSessionId(null);
		}
	};

	return (
		<DashboardLayout>
			{/* Header */}
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-ink">Chat History</h1>
				<p className="text-sm text-ink-muted mt-1">
					Your past conversations with ConnectNepal Assistant
				</p>
			</div>

			{/* Content */}
			{loading ? (
				<Loader text="Loading chat history..." />
			) : sessions.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-line p-12 text-center">
					<div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
						<MessageCircle className="w-7 h-7 text-teal-600" />
					</div>
					<p className="text-lg font-semibold text-ink-secondary">
						No chat history yet
					</p>
					<p className="text-sm text-ink-muted mt-1">
						Start a conversation using the chat button in the bottom
						right corner.
					</p>
				</div>
			) : (
				<>
					<div className="space-y-3">
						{sessions.map((session) => (
							<button
								key={session.id}
								type="button"
								onClick={() => void handleOpenSession(session.id)}
								disabled={loadingSessionId === session.id}
								className="w-full text-left bg-surface rounded-xl border border-line px-5 py-4 hover:border-teal-300 hover:shadow-sm transition-all group disabled:opacity-60"
							>
								<div className="flex items-start justify-between gap-4">
									<div className="flex-1 min-w-0">
										<p className="text-sm font-semibold text-ink truncate group-hover:text-teal-700 transition-colors">
											{session.title}
										</p>
										<div className="flex items-center gap-3 mt-1.5 text-xs text-ink-muted">
											<span>
												{session.messageCount}{' '}
												{session.messageCount === 1
													? 'message'
													: 'messages'}
											</span>
											<span className="w-1 h-1 rounded-full bg-line" />
											<span>{timeAgo(session.updatedAt)}</span>
										</div>
									</div>

									{loadingSessionId === session.id && (
										<div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
									)}
								</div>
							</button>
						))}
					</div>

					<div className="mt-6">
						<Pagination
							currentPage={page}
							totalCount={totalCount}
							pageSize={PAGE_SIZE}
							onPageChange={setPage}
						/>
					</div>
				</>
			)}
		</DashboardLayout>
	);
};

export default ChatHistory;
