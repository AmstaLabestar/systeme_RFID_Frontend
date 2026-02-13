import { Bell, LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MODULE_LABELS } from '@/app/data';
import { useAuth, useMarketplace, useNotifications, useThemeMode } from '@/app/contexts';
import { formatDateTime } from '@/app/services';
import type { ModuleKey } from '@/app/types';

interface TopbarProps {
  onOpenSidebar: () => void;
}

function resolveModuleFromPath(pathname: string): ModuleKey | null {
  if (pathname.startsWith('/dashboard/rfid-presence')) {
    return 'rfid-presence';
  }

  if (pathname.startsWith('/dashboard/rfid-porte')) {
    return 'rfid-porte';
  }

  if (pathname.startsWith('/dashboard/biometrie')) {
    return 'biometrie';
  }

  if (pathname.startsWith('/dashboard/feedback')) {
    return 'feedback';
  }

  return null;
}

export function Topbar({ onOpenSidebar }: TopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { inventory } = useMarketplace();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { mode, isDark, toggleMode } = useThemeMode();

  const activeModule = useMemo<ModuleKey | null>(
    () => resolveModuleFromPath(location.pathname),
    [location.pathname],
  );

  const moduleIdentifiers = useMemo(
    () =>
      activeModule
        ? inventory
            .filter((identifier) => identifier.module === activeModule)
            .sort((left, right) =>
              left.code.localeCompare(right.code, undefined, { numeric: true, sensitivity: 'base' }),
            )
        : [],
    [inventory, activeModule],
  );

  const moduleIdentifierSummary = useMemo(
    () => ({
      total: moduleIdentifiers.length,
      assigned: moduleIdentifiers.filter((identifier) => identifier.status === 'assigned').length,
      available: moduleIdentifiers.filter((identifier) => identifier.status === 'available').length,
    }),
    [moduleIdentifiers],
  );

  const scopedNotifications = useMemo(
    () =>
      notifications
        .filter((notification) => {
          if (!activeModule) {
            return true;
          }
          return !notification.module || notification.module === activeModule;
        })
        .slice(0, 5),
    [notifications, activeModule],
  );

  const handleLogout = () => {
    signOut();
    navigate('/auth/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-soft)] bg-[var(--surface-veil)] backdrop-blur-lg">
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-square md:hidden"
            onClick={onOpenSidebar}
            aria-label="Ouvrir la navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Dashboard</p>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{user?.company ?? 'Workspace'}</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-circle md:btn-outline md:btn-sm md:w-auto md:px-3"
            onClick={toggleMode}
            aria-label={`Activer le theme ${isDark ? 'clair' : 'sombre'}`}
            title={`Theme: ${mode === 'dark' ? 'sombre' : 'clair'}`}
          >
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span className="hidden md:inline text-xs uppercase tracking-[0.1em]">
              {mode === 'dark' ? 'Sombre' : 'Clair'}
            </span>
          </button>

          <div className="dropdown dropdown-end">
            <button className="btn btn-ghost btn-circle" type="button">
              <div className="indicator">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && <span className="badge badge-xs indicator-item badge-info"></span>}
              </div>
            </button>
            <div className="card dropdown-content z-[40] mt-3 w-96 border border-[var(--border-soft)] bg-[var(--card-bg)] shadow-xl">
              <div className="card-body gap-3 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <button type="button" className="link link-info text-xs" onClick={markAllAsRead}>
                      Tout marquer lu
                    </button>
                  )}
                </div>

                {activeModule ? (
                  <div className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-secondary)]">
                        Identifiants {MODULE_LABELS[activeModule]}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {moduleIdentifiers.length > 0 ? (
                          moduleIdentifiers.slice(0, 24).map((identifier) => (
                            <span
                              key={identifier.id}
                              className={`badge badge-outline font-mono ${
                                identifier.status === 'assigned' ? 'badge-success' : 'badge-info'
                              }`}
                            >
                              {identifier.code}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[var(--text-secondary)]">
                            Aucun identifiant livre pour ce module.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-2 text-xs">
                      <span className="text-[var(--text-secondary)]">
                        Disponibles: {moduleIdentifierSummary.available}
                      </span>
                      <span className="font-semibold text-[var(--success-main)]">
                        Utilises: {moduleIdentifierSummary.assigned}
                      </span>
                    </div>

                    {moduleIdentifierSummary.total > 24 ? (
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        +{moduleIdentifierSummary.total - 24} identifiants supplementaires
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {scopedNotifications.length > 0 ? (
                  <ul className="space-y-2">
                    {scopedNotifications.map((notification) => (
                      <li
                        key={notification.id}
                        className={`rounded-xl border p-3 transition-colors ${
                          notification.read
                            ? 'border-[var(--border-soft)] bg-[var(--surface-muted)]'
                            : 'border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10'
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{notification.title}</p>
                          <p className="mt-1 text-xs text-[var(--text-secondary)]">{notification.message}</p>
                          <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                            {formatDateTime(notification.createdAt)}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    {activeModule
                      ? `Aucune notification recente pour ${MODULE_LABELS[activeModule]}.`
                      : 'Aucune notification recente.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <button type="button" className="btn btn-outline btn-info" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Deconnexion</span>
          </button>
        </div>
      </div>
    </header>
  );
}
