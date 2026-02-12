import type { ReactNode } from 'react';
import {
  AuthProvider,
  MarketplaceProvider,
  NotificationsProvider,
  ServicesProvider,
} from '@/app/contexts';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <MarketplaceProvider>
          <ServicesProvider>{children}</ServicesProvider>
        </MarketplaceProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}
