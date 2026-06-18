import type { AxiosError } from 'axios';
import api from '@services/api.service';
import { extractApiError } from '@utils/apiError';
import type {
	SendMessageRequest,
	SendMessageResponse,
	PaginatedChatSessions,
	ChatSessionDetail,
} from '@/types/chatbot';

const chatbotService = {
	sendMessage: async (data: SendMessageRequest): Promise<SendMessageResponse> => {
		try {
			const res = await api.post<SendMessageResponse>('/chatbot/chat/', data, {
				timeout: 120_000,
			});
			return res.data;
		} catch (error) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 429) {
				throw new Error(
					"You're sending messages too quickly. Please wait a moment and try again.",
				);
			}
			return extractApiError(error, 'Failed to send message');
		}
	},

	listSessions: async (page = 1): Promise<PaginatedChatSessions> => {
		try {
			const res = await api.get<PaginatedChatSessions>('/chatbot/sessions/', {
				params: { page },
			});
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to load chat sessions');
		}
	},

	getSessionDetail: async (sessionId: number): Promise<ChatSessionDetail> => {
		try {
			const res = await api.get<ChatSessionDetail>(
				`/chatbot/sessions/${sessionId}/`,
			);
			return res.data;
		} catch (error) {
			return extractApiError(error, 'Failed to load chat session');
		}
	},
};

export default chatbotService;
