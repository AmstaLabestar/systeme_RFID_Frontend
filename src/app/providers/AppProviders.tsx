import type { ReactNode } from 'react';
import {
  AuthProvider,
  I18nProvider,
  MarketplaceProvider,
  NotificationsProvider,
  ServicesProvider,
  ThemeProvider,
} from '@/app/contexts';
import { AppQueryProvider } from './QueryProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppQueryProvider>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <NotificationsProvider>
              <MarketplaceProvider>
                <ServicesProvider>{children}</ServicesProvider>
              </MarketplaceProvider>
            </NotificationsProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </AppQueryProvider>
  );
}
