import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import PageLoader from '@components/feedback/PageLoader';
import { ROUTES } from '@/constants/routes';
import { getPostLoginRoute } from '@utils/authRouting';
import type { UserRole } from '@/types/accounts';

interface RoleRoutesProps {
	allowedRoles: UserRole[];
	allowGuests?: boolean;
}

const RoleRoutes = ({ allowedRoles, allowGuests = false }: RoleRoutesProps) => {
	const { user, loading, isLoggingOut } = useAuth();

	if (loading) {
		return <PageLoader />;
	}

	if (!user) {
		if (isLoggingOut) {
			return <Navigate to={ROUTES.HOME} replace />;
		}
		return allowGuests ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />;
	}

	if (!allowedRoles.includes(user.role)) {
		return <Navigate to={getPostLoginRoute(user)} replace />;
	}

	return <Outlet />;
};

export default RoleRoutes;
