import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { AppNotification, ModuleKey, NotificationKind } from '@/app/types';
import { createId } from '@/app/services';

interface CreateNotificationInput {
  title: string;
  message: string;
  kind?: NotificationKind;
  module?: ModuleKey;
  withToast?: boolean;
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (input: CreateNotificationInput) => AppNotification;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

const initialNotifications: AppNotification[] = [
  {
    id: 'notif-welcome',
    title: 'Bienvenue',
    message: 'Plateforme IoT initialisee. Utilisez le Marketplace pour demarrer vos modules.',
    kind: 'info',
    read: false,
    createdAt: new Date().toISOString(),
  },
];

function pushToast(kind: NotificationKind, title: string, message: string): void {
  const toastMessage = `${title}: ${message}`;

  if (kind === 'success') {
    toast.success(toastMessage);
    return;
  }

  if (kind === 'error') {
    toast.error(toastMessage);
    return;
  }

  if (kind === 'warning') {
    toast.warning(toastMessage);
    return;
  }

  toast.info(toastMessage);
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);

  const addNotification = useCallback(
    (input: CreateNotificationInput): AppNotification => {
      const nextNotification: AppNotification = {
        id: createId('notif'),
        title: input.title,
        message: input.message,
        kind: input.kind ?? 'info',
        module: input.module,
        read: false,
        createdAt: new Date().toISOString(),
      };

      setNotifications((currentNotifications) => [nextNotification, ...currentNotifications]);

      if (input.withToast) {
        pushToast(nextNotification.kind, nextNotification.title, nextNotification.message);
      }

      return nextNotification;
    },
    [],
  );

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification,
      ),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({ ...notification, read: true })),
    );
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
    }),
    [notifications, unreadCount, addNotification, markAsRead, markAllAsRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider.');
  }

  return context;
}
