import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/contexts';

export function PrivateRoute() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

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

  return <Outlet />;
}
