/**
 * AuthProvider
 * ------------
 * Centralized authentication state manager using React Context.
 *
 * Responsibilities:
 * - Persist current user & access token in state
 * - Initialize session on page load (refresh token → fetch user)
 * - Provide login/logout helpers
 * - Sync access token with Axios interceptors
 * - Handle automatic refresh token rotation
 *
 * Uses:
 * - axios interceptors (via setAuthTokenHandlers)
 * - FastAPI/Django-style JWT rotation (access + refresh cookie)
 */

import {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
	useRef,
} from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import authService from '@services/auth.service';
import { setAuthTokenHandlers } from '@services/api.service';
import type { Account, LoginRequest, LoginResponse } from '@/types/accounts';
import { getPostLoginRoute } from '@utils/authRouting';
import { ROUTES } from '@/constants/routes';

const LOGOUT_REDIRECT_KEY = 'auth:logout-redirect';

const hasPendingLogoutRedirect = () => {
	if (typeof window === 'undefined') return false;
	return window.sessionStorage.getItem(LOGOUT_REDIRECT_KEY) === '1';
};

const setPendingLogoutRedirect = () => {
	if (typeof window === 'undefined') return;
	window.sessionStorage.setItem(LOGOUT_REDIRECT_KEY, '1');
};

const clearPendingLogoutRedirect = () => {
	if (typeof window === 'undefined') return;
	window.sessionStorage.removeItem(LOGOUT_REDIRECT_KEY);
};

type AuthContextValue = {
    user: Account | null;
	accessToken: string | null;
	loading: boolean;
	isLoggingOut: boolean;
	login: (credentials: { email: string; password: string }) => Promise<LoginResponse>;
	logout: () => Promise<void>;
	updateUser: (user: Account) => void;
	isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);


export const AuthProvider = ({ children }: { children: ReactNode }) => {
    /**
	 * Main auth state
	 */
	const [user, setUser] = useState<Account | null>(null);
	const [accessToken, setAccessToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [isLoggingOut, setIsLoggingOut] = useState(hasPendingLogoutRedirect);

    const navigate = useNavigate();
	const location = useLocation();

    /**
	 * Refs prevent unnecessary rerenders when tokens update.
	*/
	const didInit = useRef(false);
	const accessTokenRef = useRef<string | null>(null);

    /**
	 * Provide token getter to Axios interceptor.
	 */
	const getAccessToken = useCallback(() => accessTokenRef.current, []);


    /**
	 * Refresh access token when Axios receives 401 responses.
	 */
	const refreshAccessToken = useCallback(async () => {
		try {
			const newAccessToken = await authService.refreshToken();
			accessTokenRef.current = newAccessToken;
			setAccessToken(newAccessToken);
			return newAccessToken;
		} catch (error) {
			// Refresh token invalid → force logout
			setPendingLogoutRedirect();
			setIsLoggingOut(true);
			accessTokenRef.current = null;
			setAccessToken(null);
			setUser(null);
			void navigate(ROUTES.HOME, { replace: true });
			throw error;
		}
	}, [navigate]);


    /**
	 * Register token handlers with Axios on mount.
	 */
	useEffect(() => {
		setAuthTokenHandlers(getAccessToken, refreshAccessToken);
	}, [getAccessToken, refreshAccessToken]);


    /**
	 * Initialize auth state on first render.
	 * Attempts:
	 *   1. refreshToken() using refresh cookie
	 *   2. If successful → fetch /me profile
	 */
	useEffect(() => {
		if (didInit.current) return;
		didInit.current = true;

		const initAuth = async () => {
			try {
				const newAccessToken = await authService.refreshToken();

				if (newAccessToken) {
					accessTokenRef.current = newAccessToken;
					setAccessToken(newAccessToken);

					const userData = await authService.getCurrentUser();
					setUser(userData);
				}
			} catch {
				if (import.meta.env.DEV) console.log('No active session');
			} finally {
				setLoading(false);
			}
		};

		void initAuth();
	}, []);

	useEffect(() => {
		if (location.pathname === ROUTES.HOME && hasPendingLogoutRedirect()) {
			clearPendingLogoutRedirect();
			setIsLoggingOut(false);
		}
	}, [location.pathname]);


    /**
	 * Perform login:
	 * - Authenticate user
	 * - Update token + user
	 * - Redirect depending on onboarding state
	 */
	const login = async (credentials: LoginRequest) => {
		const data = await authService.login(credentials);

		accessTokenRef.current = data.access;
		setAccessToken(data.access);
		setUser(data.user);

		void navigate(getPostLoginRoute(data.user));

		return data;
	};


    /**
	 * Logout user:
	 * - Invalidate session server-side
	 * - Clear local auth state
	 * - Redirect to login
	 */
	const logout = async () => {
		try {
			await authService.logout();
			} finally {
				setPendingLogoutRedirect();
				setIsLoggingOut(true);
				accessTokenRef.current = null;
				setAccessToken(null);
				setUser(null);
				void navigate(ROUTES.HOME, { replace: true });
			}
		};


    /**
	 * Update stored user, e.g. after editing profile.
	 */
	const updateUser = (userData: Account) => setUser(userData);

	/**
	 * Context value shared across app.
	 */
	const value: AuthContextValue = {
		user,
		accessToken,
		loading,
		isLoggingOut,
		login,
		logout,
		updateUser,
		isAuthenticated: !!user && !!accessToken
	};

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


/**
 * Hook convenience wrapper.
 * 
 * Ensures usage inside a valid provider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used within AuthProvider');
	return ctx;
};
