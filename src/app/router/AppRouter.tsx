import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/app/contexts';
import { DashboardLayout } from '@/app/layout';
import { GoogleCallbackPage, LoginPage, RegisterPage, WhatsAppOtpPage } from '@/app/pages/auth';
import {
  BiometriePage,
  FeedbackPage,
  HistoriquePage,
  MarketplacePage,
  OverviewPage,
  RfidPortePage,
  RfidPresencePage,
} from '@/app/pages/dashboard';
import { PrivateRoute } from './PrivateRoute';

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
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
        <Route path="/auth/whatsapp" element={<WhatsAppOtpPage />} />

        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="marketplace" element={<MarketplacePage />} />
            <Route path="rfid-presence" element={<RfidPresencePage />} />
            <Route path="rfid-porte" element={<RfidPortePage />} />
            <Route path="biometrie" element={<BiometriePage />} />
            <Route path="feedback" element={<FeedbackPage />} />
            <Route path="historique" element={<HistoriquePage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
