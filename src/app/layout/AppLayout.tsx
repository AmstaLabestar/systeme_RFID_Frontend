import type { ReactNode } from 'react';
import type { Notifications } from '@/app/shared/types';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  companyName: string;
  notifications: Notifications;
  children: ReactNode;
}

export function AppLayout({
  companyName,
  notifications,
  children,
}: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header companyName={companyName} notifications={notifications} />

        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
