import type { AxiosError } from 'axios';

/**
 * Extract a human-readable message from an Axios error.
 * Used across all service files — single source of truth.
 */
export const extractApiError = (error: unknown, fallback: string): never => {
	const axiosError = error as AxiosError<{
		detail?: string;
		message?: string;
		remarks?: string[];
		[key: string]: unknown;
	}>;

	if (axiosError.response?.data) {
		const data = axiosError.response.data;

		if (typeof data === 'object') {
			for (const key of Object.keys(data)) {
				const val = data[key];
				if (Array.isArray(val) && typeof val[0] === 'string') {
					throw new Error(val[0]);
				}
			}
		}

		if (data.detail) throw new Error(String(data.detail));
		if (data.message) throw new Error(String(data.message));
	}

	if (axiosError.request) {
		throw new Error('Network error. Please check your connection.');
	}

	throw new Error(fallback);
};
