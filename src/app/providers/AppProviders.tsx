import type { ReactNode } from 'react';
import {
  AuthProvider,
  MarketplaceProvider,
  NotificationsProvider,
  ServicesProvider,
  ThemeProvider,
} from '@/app/contexts';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <MarketplaceProvider>
            <ServicesProvider>{children}</ServicesProvider>
          </MarketplaceProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
