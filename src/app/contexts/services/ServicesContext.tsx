import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createContext,
  useEffect,
  useRef,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { accessService, queryKeys } from '@/app/services';
import { useAuth } from '@/app/contexts/auth';
import { useMarketplace } from '@/app/contexts/marketplace';
import { useNotifications } from '@/app/contexts/notifications';
import type {
  AssignIdentifierInput,
  Employee,
  FeedbackRecord,
  HistoryEvent,
  ModuleKey,
  PresenceSnapshotEvent,
  ReassignIdentifierInput,
  ServiceAssignment,
  PresenceRealtimeScanEvent,
} from '@/app/types';
import type { PresenceSnapshotPayload, ServicesStatePayload } from '@/app/services/types';

interface ServicesContextValue {
  employees: Employee[];
  assignments: ServiceAssignment[];
  history: HistoryEvent[];
  feedbackRecords: FeedbackRecord[];
  presenceSnapshot: PresenceSnapshotPayload | null;
  assignIdentifier: (input: AssignIdentifierInput) => Promise<void>;
  removeAssignment: (assignmentId: string) => Promise<void>;
  reassignIdentifier: (input: ReassignIdentifierInput) => Promise<void>;
  disableIdentifier: (input: { identifierId: string; reason: string }) => Promise<void>;
  refreshPresenceSnapshot: () => Promise<void>;
  getAssignmentsByModule: (module: ModuleKey) => ServiceAssignment[];
  getHistoryByModule: (module?: ModuleKey) => HistoryEvent[];
  getHistoryByDevice: (deviceId: string, module?: ModuleKey) => HistoryEvent[];
  getEmployeeById: (employeeId: string) => Employee | undefined;
}

const ServicesContext = createContext<ServicesContextValue | undefined>(undefined);

const emptyServicesState = {
  employees: [] as Employee[],
  assignments: [] as ServiceAssignment[],
  history: [] as HistoryEvent[],
  feedbackRecords: [] as FeedbackRecord[],
};

const PRESENCE_LOOKBACK_HOURS = 24;
const PRESENCE_LAST_EVENTS_LIMIT = 50;

function toPresenceSnapshotEventFromRealtimeScan(
  event: PresenceRealtimeScanEvent,
): PresenceSnapshotEvent {
  return {
    id: event.historyEventId,
    deviceId: event.deviceId,
    deviceName: event.deviceName,
    employee: event.employeeName,
    identifier: event.identifierCode,
    occurredAt: event.occurredAt,
    attributed: event.attributed,
  };
}

function toHistoryEventFromRealtimeScan(event: PresenceRealtimeScanEvent): HistoryEvent {
  return {
    id: event.historyEventId,
    module: 'rfid-presence',
    deviceId: event.deviceId,
    employee: event.employeeName,
    identifier: event.identifierCode,
    device: event.deviceName,
    eventType: 'identifier_scanned',
    action: event.attributed ? 'Badge scanne presence' : 'Badge scanne non attribue',
    metadata: {
      streamEventId: event.id,
      ingestionEventId: event.ingestionEventId,
      ingestionInboxId: event.ingestionInboxId,
      attributed: event.attributed,
    },
    occurredAt: event.occurredAt,
  };
}

function applyRealtimeScanToPresenceSnapshot(
  currentSnapshot: PresenceSnapshotPayload | undefined,
  scanEvent: PresenceRealtimeScanEvent,
): PresenceSnapshotPayload | undefined {
  if (!currentSnapshot) {
    return currentSnapshot;
  }

  const eventId = scanEvent.historyEventId;
  if (currentSnapshot.lastScans.some((entry) => entry.id === eventId)) {
    return currentSnapshot;
  }

  const nextLastScans = [
    toPresenceSnapshotEventFromRealtimeScan(scanEvent),
    ...currentSnapshot.lastScans,
  ].slice(0, PRESENCE_LAST_EVENTS_LIMIT);

  const deviceIndex = currentSnapshot.byDevice.findIndex(
    (entry) => entry.deviceId === scanEvent.deviceId,
  );
  const currentDevice =
    deviceIndex >= 0
      ? currentSnapshot.byDevice[deviceIndex]
      : {
          deviceId: scanEvent.deviceId,
          deviceName: scanEvent.deviceName,
          totalScans: 0,
          attributedScans: 0,
          unattributedScans: 0,
          lastScanAt: null,
        };

  const nextDevice = {
    ...currentDevice,
    deviceName: scanEvent.deviceName,
    totalScans: currentDevice.totalScans + 1,
    attributedScans: currentDevice.attributedScans + (scanEvent.attributed ? 1 : 0),
    unattributedScans: currentDevice.unattributedScans + (scanEvent.attributed ? 0 : 1),
    lastScanAt: scanEvent.occurredAt,
  };

  const nextByDevice = [...currentSnapshot.byDevice];
  if (deviceIndex >= 0) {
    nextByDevice[deviceIndex] = nextDevice;
  } else {
    nextByDevice.push(nextDevice);
  }
  nextByDevice.sort((left, right) => {
    if (right.totalScans !== left.totalScans) {
      return right.totalScans - left.totalScans;
    }

    const leftDate = left.lastScanAt ? Date.parse(left.lastScanAt) : 0;
    const rightDate = right.lastScanAt ? Date.parse(right.lastScanAt) : 0;
    return rightDate - leftDate;
  });

  return {
    ...currentSnapshot,
    totals: {
      ...currentSnapshot.totals,
      totalScans: currentSnapshot.totals.totalScans + 1,
      attributedScans: currentSnapshot.totals.attributedScans + (scanEvent.attributed ? 1 : 0),
      unattributedScans:
        currentSnapshot.totals.unattributedScans + (scanEvent.attributed ? 0 : 1),
    },
    byDevice: nextByDevice,
    lastScans: nextLastScans,
    periodEndAt: new Date().toISOString(),
  };
}

export function ServicesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userScope = user?.id ?? 'guest';
  const lastSnapshotRefreshAtRef = useRef(0);

  const { applyMarketplaceState } = useMarketplace();
  const { addNotification } = useNotifications();

  const servicesStateQuery = useQuery({
    queryKey: queryKeys.services.state(userScope),
    queryFn: accessService.fetchServicesState,
    enabled: Boolean(user),
  });

  const servicesState = servicesStateQuery.data ?? emptyServicesState;
  const employees = servicesState.employees;
  const assignments = servicesState.assignments;
  const history = servicesState.history;
  const feedbackRecords = servicesState.feedbackRecords;

  const presenceSnapshotQuery = useQuery({
    queryKey: queryKeys.services.presenceSnapshot(
      userScope,
      PRESENCE_LOOKBACK_HOURS,
      PRESENCE_LAST_EVENTS_LIMIT,
    ),
    queryFn: () =>
      accessService.fetchPresenceSnapshot({
        lookbackHours: PRESENCE_LOOKBACK_HOURS,
        lastEventsLimit: PRESENCE_LAST_EVENTS_LIMIT,
      }),
    enabled: Boolean(user),
  });
  const presenceSnapshot = presenceSnapshotQuery.data ?? null;

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let stream: { close: () => void } | null = null;
    try {
      stream = accessService.openPresenceStream({
        onScan: (scanEvent) => {
          queryClient.setQueryData<ServicesStatePayload>(
            queryKeys.services.state(userScope),
            (currentState) => {
              const baseState = currentState ?? emptyServicesState;
              if (baseState.history.some((entry) => entry.id === scanEvent.historyEventId)) {
                return baseState;
              }

              return {
                ...baseState,
                history: [toHistoryEventFromRealtimeScan(scanEvent), ...baseState.history],
              };
            },
          );

          queryClient.setQueryData<PresenceSnapshotPayload | undefined>(
            queryKeys.services.presenceSnapshot(
              userScope,
              PRESENCE_LOOKBACK_HOURS,
              PRESENCE_LAST_EVENTS_LIMIT,
            ),
            (currentSnapshot) => applyRealtimeScanToPresenceSnapshot(currentSnapshot, scanEvent),
          );

          const now = Date.now();
          if (now - lastSnapshotRefreshAtRef.current >= 10_000) {
            lastSnapshotRefreshAtRef.current = now;
            void queryClient.invalidateQueries({
              queryKey: queryKeys.services.presenceSnapshot(
                userScope,
                PRESENCE_LOOKBACK_HOURS,
                PRESENCE_LAST_EVENTS_LIMIT,
              ),
            });
          }
        },
      });
    } catch {
      return undefined;
    }

    return () => {
      stream?.close();
    };
  }, [queryClient, user, userScope]);

  const refreshPresenceSnapshot = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.services.presenceSnapshot(
        userScope,
        PRESENCE_LOOKBACK_HOURS,
        PRESENCE_LAST_EVENTS_LIMIT,
      ),
    });
  }, [queryClient, userScope]);

  const assignMutation = useMutation({
    mutationFn: accessService.assignIdentifier,
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.services.state(userScope), response.servicesState);
      applyMarketplaceState(response.marketplaceState);
    },
    mutationKey: ['services', 'assign', userScope],
  });

  const removeMutation = useMutation({
    mutationFn: (assignmentId: string) => accessService.removeAssignment(assignmentId),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.services.state(userScope), response.servicesState);
      applyMarketplaceState(response.marketplaceState);
    },
    mutationKey: ['services', 'remove', userScope],
  });

  const reassignMutation = useMutation({
    mutationFn: accessService.reassignIdentifier,
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.services.state(userScope), response.servicesState);
      applyMarketplaceState(response.marketplaceState);
    },
    mutationKey: ['services', 'reassign', userScope],
  });

  const disableMutation = useMutation({
    mutationFn: accessService.disableIdentifier,
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.services.state(userScope), response.servicesState);
      applyMarketplaceState(response.marketplaceState);
    },
    mutationKey: ['services', 'disable', userScope],
  });

  const assignIdentifier = useCallback(
    async (input: AssignIdentifierInput) => {
      const response = await assignMutation.mutateAsync(input);

      addNotification({
        title: 'Identifiant assigne',
        message: `${response.meta.identifierCode} associe a ${response.meta.employeeName} sur ${response.meta.deviceName}.`,
        module: response.meta.module,
        kind: 'success',
        withToast: true,
      });
    },
    [assignMutation, addNotification],
  );

  const removeAssignment = useCallback(
    async (assignmentId: string) => {
      const response = await removeMutation.mutateAsync(assignmentId);

      addNotification({
        title: 'Association retiree',
        message: `${response.meta.identifierCode} est redevenu disponible.`,
        module: response.meta.module,
        kind: 'warning',
        withToast: true,
      });
    },
    [removeMutation, addNotification],
  );

  const reassignIdentifier = useCallback(
    async (input: ReassignIdentifierInput) => {
      const response = await reassignMutation.mutateAsync(input);

      addNotification({
        title: 'Identifiant reattribue',
        message: `${response.meta.identifierCode} est maintenant lie a ${response.meta.employeeName}.`,
        module: response.meta.module,
        kind: 'success',
        withToast: true,
      });
    },
    [reassignMutation, addNotification],
  );

  const disableIdentifier = useCallback(
    async (input: { identifierId: string; reason: string }) => {
      const response = await disableMutation.mutateAsync(input);

      addNotification({
        title: 'Identifiant desactive',
        message: `${response.meta.identifierCode} a ete desactive.`,
        module: response.meta.module,
        kind: 'warning',
        withToast: true,
      });
    },
    [disableMutation, addNotification],
  );

  const getAssignmentsByModule = useCallback(
    (module: ModuleKey): ServiceAssignment[] =>
      assignments.filter((assignment) => assignment.module === module),
    [assignments],
  );

  const getHistoryByModule = useCallback(
    (module?: ModuleKey): HistoryEvent[] => {
      if (!module) {
        return history;
      }

      return history.filter((entry) => entry.module === module);
    },
    [history],
  );

  const getHistoryByDevice = useCallback(
    (deviceId: string, module?: ModuleKey): HistoryEvent[] =>
      history.filter((entry) => entry.deviceId === deviceId && (!module || entry.module === module)),
    [history],
  );

  const getEmployeeById = useCallback(
    (employeeId: string): Employee | undefined => employees.find((employee) => employee.id === employeeId),
    [employees],
  );

  const value = useMemo(
    () => ({
      employees,
      assignments,
      history,
      feedbackRecords,
      presenceSnapshot,
      assignIdentifier,
      removeAssignment,
      reassignIdentifier,
      disableIdentifier,
      refreshPresenceSnapshot,
      getAssignmentsByModule,
      getHistoryByModule,
      getHistoryByDevice,
      getEmployeeById,
    }),
    [
      employees,
      assignments,
      history,
      feedbackRecords,
      presenceSnapshot,
      assignIdentifier,
      removeAssignment,
      reassignIdentifier,
      disableIdentifier,
      refreshPresenceSnapshot,
      getAssignmentsByModule,
      getHistoryByModule,
      getHistoryByDevice,
      getEmployeeById,
    ],
  );

  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServices(): ServicesContextValue {
  const context = useContext(ServicesContext);

  if (!context) {
    throw new Error('useServices must be used within ServicesProvider.');
  }

  return context;
}
