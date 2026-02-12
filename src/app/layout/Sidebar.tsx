import {
  Activity,
  BarChart3,
  DoorOpen,
  Fingerprint,
  History,
  LayoutDashboard,
  MessageSquare,
  ShoppingCart,
  UserCircle2,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { BASE_NAV_ITEMS } from '@/app/data';
import { useMarketplace } from '@/app/contexts';
import type { DashboardPage } from '@/app/types';

interface SidebarProps {
  onNavigate?: () => void;
}

const iconMap: Record<DashboardPage, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  marketplace: ShoppingCart,
  'rfid-presence': UserCircle2,
  'rfid-porte': DoorOpen,
  biometrie: Fingerprint,
  feedback: MessageSquare,
  historique: History,
};

export function Sidebar({ onNavigate }: SidebarProps) {
  const { isModuleEnabled } = useMarketplace();

  const visibleItems = BASE_NAV_ITEMS.filter((item) => !item.module || isModuleEnabled(item.module));

  return (
    <aside className="flex h-full w-72 flex-col border-r border-[var(--border-soft)] bg-[var(--sidebar-bg)] text-[var(--text-primary)]">
      <div className="border-b border-[var(--border-soft)] px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[var(--accent-primary)]/20 p-2">
            <Activity className="h-6 w-6 text-[var(--accent-primary)]" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-secondary)]">SaaS IoT</p>
            <h1 className="text-lg font-bold">Tech Souveraine</h1>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = iconMap[item.page] ?? BarChart3;

            return (
              <li key={item.page}>
                <NavLink
                  to={item.path}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 rounded-r-xl border-l-4 px-4 py-3 transition-colors',
                      isActive
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                        : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--card-bg)] hover:text-[var(--text-primary)]',
                    ].join(' ')
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-[var(--border-soft)] px-6 py-4 text-xs text-[var(--text-secondary)]">
        Modules actifs selon achats et configuration.
      </div>
    </aside>
  );
}
