import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import PageLoader from '@components/feedback/PageLoader';
import { getPostLoginRoute, isOnboardingComplete } from '@utils/authRouting';
import { ROUTES } from '@/constants/routes';

const PrivateRoutes = () => {
	const { user, loading, isLoggingOut } = useAuth();
	const location = useLocation();

	if (loading) {
		return <PageLoader />;
	}

	if (!user) {
		if (isLoggingOut) {
			return <Navigate to={ROUTES.HOME} replace />;
		}
		return <Navigate to={ROUTES.LOGIN} replace />;
	}

	// Guard: If onboarding incomplete and user is NOT on an onboarding route → redirect to onboarding
	const isOnboardingRoute = location.pathname.startsWith(`${ROUTES.ONBOARDING_BASE}/`);
	const onboardingComplete = isOnboardingComplete(user);
	if (!onboardingComplete && !isOnboardingRoute) {
		return <Navigate to={getPostLoginRoute(user)} replace />;
	}

	// Guard: If onboarding complete and user IS on an onboarding route → redirect to dashboard.
	// Exception: completion screens (and host documents) are shown *after* onboarding
	// is marked complete on the backend, so they must be allowed through.
	const allowedAfterComplete = new Set<string>([
		ROUTES.TRAVELLER_ONBOARDING_COMPLETE,
		ROUTES.HOST_ONBOARDING_DOCUMENTS,
		ROUTES.HOST_ONBOARDING_COMPLETE,
	]);
	if (onboardingComplete && isOnboardingRoute && !allowedAfterComplete.has(location.pathname)) {
		return <Navigate to={getPostLoginRoute(user)} replace />;
	}

	return <Outlet />;
};

export default PrivateRoutes;
