import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useI18n } from '@/app/contexts';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function DashboardLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-primary)]">
      <div className="flex min-h-screen">
        <div
          className={`fixed inset-y-0 left-0 z-30 w-72 transform transition-transform md:static md:z-auto md:translate-x-0 ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar onNavigate={() => setMobileSidebarOpen(false)} />
        </div>

        {mobileSidebarOpen && (
          <button
            type="button"
            aria-label={t('topbar.closeNavigation')}
            className="fixed inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar onOpenSidebar={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 p-4 md:p-8">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
