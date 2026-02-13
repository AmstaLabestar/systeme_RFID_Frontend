import type { ReactNode } from 'react';
import {
  AuthProvider,
  MarketplaceProvider,
  NotificationsProvider,
  ServicesProvider,
  ThemeProvider,
} from '@/app/contexts';
import { AppQueryProvider } from './QueryProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppQueryProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotificationsProvider>
            <MarketplaceProvider>
              <ServicesProvider>{children}</ServicesProvider>
            </MarketplaceProvider>
          </NotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </AppQueryProvider>
  );
}
