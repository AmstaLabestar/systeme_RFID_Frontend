import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/app/contexts';
import { PrivateRoute } from './PrivateRoute';

const DashboardLayout = lazy(() =>
  import('@/app/layout/DashboardLayout').then((module) => ({
    default: module.DashboardLayout,
  })),
);

const LoginPage = lazy(() =>
  import('@/app/pages/auth/LoginPage').then((module) => ({
    default: module.LoginPage,
  })),
);

const RegisterPage = lazy(() =>
  import('@/app/pages/auth/RegisterPage').then((module) => ({
    default: module.RegisterPage,
  })),
);

const GoogleCallbackPage = lazy(() =>
  import('@/app/pages/auth/GoogleCallbackPage').then((module) => ({
    default: module.GoogleCallbackPage,
  })),
);

const MagicLinkCallbackPage = lazy(() =>
  import('@/app/pages/auth/MagicLinkCallbackPage').then((module) => ({
    default: module.MagicLinkCallbackPage,
  })),
);

const PublicFeedbackPage = lazy(() =>
  import('@/app/pages/public/PublicFeedbackPage').then((module) => ({
    default: module.PublicFeedbackPage,
  })),
);

const OverviewPage = lazy(() =>
  import('@/app/pages/dashboard/OverviewPage').then((module) => ({
    default: module.OverviewPage,
  })),
);

const MarketplacePage = lazy(() =>
  import('@/app/pages/dashboard/MarketplacePage').then((module) => ({
    default: module.MarketplacePage,
  })),
);

const AdminStockPage = lazy(() =>
  import('@/app/pages/dashboard/AdminStockPage').then((module) => ({
    default: module.AdminStockPage,
  })),
);

const RfidPresencePage = lazy(() =>
  import('@/app/pages/dashboard/RfidPresencePage').then((module) => ({
    default: module.RfidPresencePage,
  })),
);

const RfidPortePage = lazy(() =>
  import('@/app/pages/dashboard/RfidPortePage').then((module) => ({
    default: module.RfidPortePage,
  })),
);

const BiometriePage = lazy(() =>
  import('@/app/pages/dashboard/BiometriePage').then((module) => ({
    default: module.BiometriePage,
  })),
);

const FeedbackPage = lazy(() =>
  import('@/app/pages/dashboard/FeedbackPage').then((module) => ({
    default: module.FeedbackPage,
  })),
);

const HistoriquePage = lazy(() =>
  import('@/app/pages/dashboard/HistoriquePage').then((module) => ({
    default: module.HistoriquePage,
  })),
);

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
      <span className="loading loading-spinner loading-lg text-info"></span>
    </div>
  );
}

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <span className="loading loading-spinner loading-lg text-info"></span>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard/overview" replace />;
  }

  return <Navigate to="/auth/login" replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
          <Route path="/auth/magic-link/callback" element={<MagicLinkCallbackPage />} />
          <Route path="/feedback/:qrToken" element={<PublicFeedbackPage />} />

          <Route element={<PrivateRoute />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<OverviewPage />} />
              <Route path="marketplace" element={<MarketplacePage />} />
              <Route element={<PrivateRoute allowedRoles={['admin']} />}>
                <Route path="admin-stock" element={<AdminStockPage />} />
              </Route>
              <Route path="rfid-presence" element={<RfidPresencePage />} />
              <Route path="rfid-porte" element={<RfidPortePage />} />
              <Route path="biometrie" element={<BiometriePage />} />
              <Route path="feedback" element={<FeedbackPage />} />
              <Route path="historique" element={<HistoriquePage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
