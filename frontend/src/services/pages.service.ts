/**
 * Public Pages Service
 * --------------------
 * Fetches CMS-style public pages (About Us, etc.) from the backend.
 */

import api from '@services/api.service';
import type { AxiosError } from 'axios';
import { extractApiError } from '@utils/apiError';

export type PublicPage = {
	title: string;
	slug: string;
	kind: string;
	kindDisplay: string;
	content: string;
	updatedAt: string;
};

export type FaqItem = {
	id: number;
	question: string;
	answer: string;
	sort_order: number;
};

export type FaqCategoryWithItems = {
	name: string;
	slug: string;
	items: FaqItem[];
};

const pagesService = {
	/**
	 * Fetch the About Us page content.
	 * GET /api/pages/about-us/
	 */
	getAboutUs: async (): Promise<PublicPage> => {
		try {
			const res = await api.get<PublicPage>('/pages/about-us/');
			return res.data;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 404)
				throw new Error('About Us page not found');
			return extractApiError(error,'Failed to load About Us page');
		}
	},
	/**
	 * Fetch the Trust and Safety page content.
	 * GET /api/pages/trust-and-safety/
	 */
	getTrustAndSafety: async (): Promise<PublicPage> => {
		try {
			const res = await api.get<PublicPage>('/pages/trust-and-safety/');
			return res.data;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 404)
				throw new Error('Trust and Safety page not found');
			return extractApiError(error,'Failed to load Trust and Safety page');
		}
	},
	/**
	 * Fetch the Community Guidelines page content.
	 * GET /api/pages/community-guidelines/
	 */
	getCommunityGuidelines: async (): Promise<PublicPage> => {
		try {
			const res = await api.get<PublicPage>('/pages/community-guidelines/');
			return res.data;
		} catch (error: unknown) {
			const axiosError = error as AxiosError;
			if (axiosError.response?.status === 404)
				throw new Error('Community Guidelines page not found');
			return extractApiError(error,'Failed to load Community Guidelines');
		}
	},
	/**
	 * Fetch all FAQs grouped by category.
	 * GET /api/pages/faqs/
	 */
	getFaqs: async (): Promise<FaqCategoryWithItems[]> => {
		try {
			const res = await api.get<FaqCategoryWithItems[]>('/pages/faqs/');
			return res.data;
		} catch (error: unknown) {
			return extractApiError(error,'Failed to load FAQs');
		}
	},
};

export default pagesService;
