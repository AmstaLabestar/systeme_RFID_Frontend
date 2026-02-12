import type { ReactNode } from 'react';
import type { Notifications, PageId } from '@/app/shared/types';
import { Header } from './Header';
import { Sidebar, type SidebarItem } from './Sidebar';

interface AppLayoutProps {
  activePage: PageId;
  onPageChange: (page: PageId) => void;
  menuItems: SidebarItem[];
  companyName: string;
  notifications: Notifications;
  children: ReactNode;
}

export function AppLayout({
  activePage,
  onPageChange,
  menuItems,
  companyName,
  notifications,
  children,
}: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activePage={activePage} onPageChange={onPageChange} menuItems={menuItems} />

      <div className="flex-1 flex flex-col">
        <Header companyName={companyName} notifications={notifications} />

        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
