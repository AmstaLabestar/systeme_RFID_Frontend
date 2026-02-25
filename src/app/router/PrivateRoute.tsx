import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/contexts';

interface PrivateRouteProps {
  allowedRoles?: string[];
}

export function PrivateRoute({ allowedRoles }: PrivateRouteProps = {}) {
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-[var(--text-primary)]">
        <span className="loading loading-spinner loading-lg text-info"></span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedRole = user?.roleName?.trim().toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map((role) => role.trim().toLowerCase());

    if (!normalizedRole || !normalizedAllowedRoles.includes(normalizedRole)) {
      return <Navigate to="/dashboard/overview" replace />;
    }
  }

  return <Outlet />;
}
