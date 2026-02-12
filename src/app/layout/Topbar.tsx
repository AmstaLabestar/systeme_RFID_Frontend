import { Bell, LogOut, Menu } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useNotifications } from '@/app/contexts';
import { formatDateTime } from '@/app/services';

interface TopbarProps {
  onOpenSidebar: () => void;
}

export function Topbar({ onOpenSidebar }: TopbarProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const lastFiveNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);

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

                {lastFiveNotifications.length === 0 && (
                  <p className="text-sm text-[var(--text-secondary)]">Aucune notification.</p>
                )}

                <ul className="space-y-2">
                  {lastFiveNotifications.map((notification) => (
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
