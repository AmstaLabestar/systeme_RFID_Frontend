import {
  Activity,
  BarChart3,
  Boxes,
  DoorOpen,
  Fingerprint,
  History,
  LayoutDashboard,
  Moon,
  MessageSquare,
  Sun,
  ShoppingCart,
  UserCircle2,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { BASE_NAV_ITEMS } from '@/app/data';
import { useAuth, useMarketplace, useThemeMode } from '@/app/contexts';
import type { DashboardPage } from '@/app/types';

interface SidebarProps {
  onNavigate?: () => void;
}

const iconMap: Record<DashboardPage, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  marketplace: ShoppingCart,
  'admin-stock': Boxes,
  'rfid-presence': UserCircle2,
  'rfid-porte': DoorOpen,
  biometrie: Fingerprint,
  feedback: MessageSquare,
  historique: History,
};

export function Sidebar({ onNavigate }: SidebarProps) {
  const { user } = useAuth();
  const { isModuleEnabled } = useMarketplace();
  const { mode, isDark, toggleMode } = useThemeMode();
  const normalizedRole = user?.roleName?.trim().toLowerCase();

  const visibleItems = BASE_NAV_ITEMS.filter((item) => {
    if (item.module && !isModuleEnabled(item.module)) {
      return false;
    }

    if (item.roles && item.roles.length > 0) {
      if (!normalizedRole) {
        return false;
      }

      return item.roles.map((role) => role.toLowerCase()).includes(normalizedRole);
    }

    return true;
  });
  const userFullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Utilisateur';
  const userInitials =
    [user?.firstName?.charAt(0), user?.lastName?.charAt(0)]
      .filter(Boolean)
      .join('')
      .toUpperCase() || 'U';

  return (
    <aside className="flex h-full w-72 flex-col border-r border-[var(--border-soft)] bg-[var(--sidebar-bg)] text-[var(--text-primary)]">
      <div className="border-b border-[var(--border-soft)] px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[var(--accent-primary)]/20 p-2">
            <Activity className="h-6 w-6 text-[var(--accent-primary)]" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-secondary)]">Système RFID</p>
            <h1 className="text-lg font-bold">Tanga Group</h1>
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

      <div className="grid gap-4 border-t border-[var(--border-soft)] px-4 py-4">
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--card-bg)]/70 p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">Profil</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/15 text-sm font-semibold text-[var(--accent-primary)]">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{userFullName}</p>
              <p className="truncate text-xs text-[var(--text-secondary)]">{user?.email ?? 'email@inconnu.local'}</p>
            </div>
          </div>
          <p className="mt-2 truncate text-xs text-[var(--text-secondary)]">{user?.company ?? 'Workspace'}</p>
        </div>

        <button
          type="button"
          className="btn btn-outline btn-sm w-full justify-between border-[var(--border-soft)]"
          onClick={toggleMode}
          aria-label="Changer le theme"
        >
          <span className="text-xs font-medium uppercase tracking-[0.12em]">
            Theme: {mode === 'dark' ? 'sombre' : 'clair'}
          </span>
          {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        <p className="px-2 text-xs text-[var(--text-secondary)]">Modules actifs .</p>
      </div>
    </aside>
  );
}
