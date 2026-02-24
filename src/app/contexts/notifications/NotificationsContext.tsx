import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type {
  AppNotification,
  ModuleKey,
  NotificationIdentifierSections,
  NotificationKind,
} from '@/app/types';
import { useAuth } from '@/app/contexts/auth';
import { createId } from '@/app/services';

interface CreateNotificationInput {
  title: string;
  message: string;
  kind?: NotificationKind;
  module?: ModuleKey;
  withToast?: boolean;
  identifierSections?: NotificationIdentifierSections;
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (input: CreateNotificationInput) => AppNotification;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

function buildWelcomeNotifications(scope: string): AppNotification[] {
  return [
    {
      id: `notif-welcome-${scope}`,
      title: 'Bienvenue',
      message: ' Utilisez le Marketplace pour demarrer vos modules.',
      kind: 'info',
      read: false,
      createdAt: new Date().toISOString(),
    },
  ];
}

function getScopeNotifications(
  byScope: Record<string, AppNotification[]>,
  scope: string,
): AppNotification[] {
  return byScope[scope] ?? buildWelcomeNotifications(scope);
}

function withScopeNotifications(
  byScope: Record<string, AppNotification[]>,
  scope: string,
  updater: (currentNotifications: AppNotification[]) => AppNotification[],
): Record<string, AppNotification[]> {
  return {
    ...byScope,
    [scope]: updater(getScopeNotifications(byScope, scope)),
  };
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userScope = user?.id ?? 'guest';
  const [notificationsByScope, setNotificationsByScope] = useState<Record<string, AppNotification[]>>({});

  useEffect(() => {
    setNotificationsByScope((current) => {
      if (current[userScope]) {
        return current;
      }

      return {
        ...current,
        [userScope]: buildWelcomeNotifications(userScope),
      };
    });
  }, [userScope]);

  const notifications = useMemo(
    () => notificationsByScope[userScope] ?? [],
    [notificationsByScope, userScope],
  );

  const addNotification = useCallback(
    (input: CreateNotificationInput): AppNotification => {
      const nextNotification: AppNotification = {
        id: createId('notif'),
        title: input.title,
        message: input.message,
        kind: input.kind ?? 'info',
        module: input.module,
        identifierSections: input.identifierSections,
        read: false,
        createdAt: new Date().toISOString(),
      };

      setNotificationsByScope((current) =>
        withScopeNotifications(current, userScope, (currentNotifications) => [
          nextNotification,
          ...currentNotifications,
        ]),
      );

      if (input.withToast) {
        pushToast(nextNotification.kind, nextNotification.title, nextNotification.message);
      }

      return nextNotification;
    },
    [userScope],
  );

  const markAsRead = useCallback(
    (notificationId: string) => {
      setNotificationsByScope((current) =>
        withScopeNotifications(current, userScope, (currentNotifications) =>
          currentNotifications.map((notification) =>
            notification.id === notificationId ? { ...notification, read: true } : notification,
          ),
        ),
      );
    },
    [userScope],
  );

  const markAllAsRead = useCallback(() => {
    setNotificationsByScope((current) =>
      withScopeNotifications(current, userScope, (currentNotifications) =>
        currentNotifications.map((notification) => ({ ...notification, read: true })),
      ),
    );
  }, [userScope]);

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
