/**
 * Axios API Client
 * ----------------
 * Fully-featured Axios instance with:
 * - Automatic access token injection
 * - Token refresh on 401 with concurrency-safe queue
 * - snake_case ⇄ camelCase transformations
 */

import axios, { type AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { camelizeKeys, snakifyKeys, shouldTransform } from '@utils/case';

/**
 * Base Axios instance with default configuration.
 */
const api = axios.create({
	baseURL: String(import.meta.env.VITE_API_URL ?? ''),
	headers: {
		'Content-Type': 'application/json',
		accept: 'application/json',
	},
	timeout: 10000,
	withCredentials: true,
});

/**
 * Token handler functions (injected by the app).
 * Allows decoupling from storage layer (cookies, localStorage, etc.)
 */
let getAccessToken: () => string | null = () => null;
let refreshAccessToken: () => Promise<string | null> = () => Promise.resolve(null);

/**
 * State management for refresh concurrency control.
 */
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Injects token getter + token refresher used by interceptors.
 * Must be called once during app initialization.
 */
export const setAuthTokenHandlers = (
	getTokenFn: typeof getAccessToken,
	refreshTokenFn: typeof refreshAccessToken,
) => {
	getAccessToken = getTokenFn;
	refreshAccessToken = refreshTokenFn;
};

/**
 * Request Interceptor
 * - Attaches Authorization header if a token exists.
 * - Transforms request payloads to snake_case for backend compatibility.
 */
api.interceptors.request.use((config) => {
	const token = getAccessToken();
	if (token) {
		config.headers = config.headers ?? {};
		config.headers.Authorization = `Bearer ${token}`;
	}

	const data = config.data as unknown;
	if (data && (Array.isArray(data) || shouldTransform(data))) {
		config.data = snakifyKeys(data);
	}

	return config;
});

/**
 * Response Interceptor
 * 1) Converts response data keys to camelCase.
 * 2) Handles 401 errors with refresh + replay, concurrency-safe.
 */
api.interceptors.response.use(
	(response: AxiosResponse) => {
		const data = response?.data as unknown;
		if (data && (Array.isArray(data) || shouldTransform(data))) {
			response.data = camelizeKeys(data);
		}
		return response;
	},
	async (error: AxiosError) => {
		const originalRequest = (error.config || {}) as AxiosRequestConfig & { _retry?: boolean };

		// Normalize error payload keys
		if (
			error.response?.data &&
			(Array.isArray(error.response.data) || shouldTransform(error.response.data))
		) {
			error.response.data = camelizeKeys(error.response.data);
		}

		// Prevent infinite retry loops
		if (error.response?.status === 401 && originalRequest?._retry) {
			return Promise.reject(error);
		}

		const isUnauthorized = error.response?.status === 401;
		const isRefreshEndpoint = originalRequest.url?.includes('/accounts/token/refresh');

		if (isUnauthorized && !originalRequest._retry && !isRefreshEndpoint) {
			originalRequest._retry = true;

			// Wait for ongoing refresh if one exists
			if (isRefreshing && refreshPromise) {
				const newToken = await refreshPromise;
				if (newToken) {
					originalRequest.headers = originalRequest.headers ?? {};
					originalRequest.headers.Authorization = `Bearer ${newToken}`;
				}
				return api(originalRequest);
			}

			// Start a new refresh cycle
			isRefreshing = true;
			refreshPromise = refreshAccessToken()
				.then((token) => {
					isRefreshing = false;
					refreshPromise = null;
					return token;
				})
				.catch((err: unknown) => {
					isRefreshing = false;
					refreshPromise = null;
					throw err;
				});

			const newToken = await refreshPromise;

			if (!newToken) {
				return Promise.reject(error);
			}

			originalRequest.headers = originalRequest.headers ?? {};
			originalRequest.headers.Authorization = `Bearer ${newToken}`;
			return api(originalRequest);
		}

		return Promise.reject(error);
	},
);

export default api;
