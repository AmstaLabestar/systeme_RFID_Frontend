import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { buildFeedbackSeed, seedEmployees, seedHistory } from '@/app/data';
import { accessService, queryKeys, systemStoreService } from '@/app/services';
import { useAuth } from '@/app/contexts/auth';
import { useMarketplace } from '@/app/contexts/marketplace';
import { useNotifications } from '@/app/contexts/notifications';
import type {
  AssignIdentifierInput,
  Employee,
  FeedbackRecord,
  HistoryEvent,
  ModuleKey,
  ReassignIdentifierInput,
  ServiceAssignment,
} from '@/app/types';

interface ServicesContextValue {
  employees: Employee[];
  assignments: ServiceAssignment[];
  history: HistoryEvent[];
  feedbackRecords: FeedbackRecord[];
  assignIdentifier: (input: AssignIdentifierInput) => Promise<void>;
  removeAssignment: (assignmentId: string) => Promise<void>;
  reassignIdentifier: (input: ReassignIdentifierInput) => Promise<void>;
  getAssignmentsByModule: (module: ModuleKey) => ServiceAssignment[];
  getHistoryByModule: (module?: ModuleKey) => HistoryEvent[];
  getHistoryByDevice: (deviceId: string, module?: ModuleKey) => HistoryEvent[];
  getEmployeeById: (employeeId: string) => Employee | undefined;
}

const ServicesContext = createContext<ServicesContextValue | undefined>(undefined);

const initialServicesState = {
  employees: seedEmployees,
  assignments: [] as ServiceAssignment[],
  history: seedHistory,
  feedbackRecords: [] as FeedbackRecord[],
};

export function ServicesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const feedbackSeededDeviceIds = useRef(new Set<string>());
  const { user } = useAuth();
  const userScope = user?.id ?? 'guest';

  const { devices, applyMarketplaceState } = useMarketplace();
  const { addNotification } = useNotifications();

  const servicesStateQuery = useQuery({
    queryKey: queryKeys.services.state(userScope),
    queryFn: systemStoreService.fetchServicesState,
    initialData: initialServicesState,
    enabled: Boolean(user),
  });

  const servicesState = servicesStateQuery.data;
  const employees = servicesState.employees;
  const assignments = servicesState.assignments;
  const history = servicesState.history;
  const feedbackRecords = servicesState.feedbackRecords;

  const saveServicesStateMutation = useMutation({
    mutationFn: systemStoreService.saveServicesState,
  });

  const assignMutation = useMutation({
    mutationFn: accessService.assignIdentifier,
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.services.state(userScope), response.servicesState);
      applyMarketplaceState(response.marketplaceState);
    },
    mutationKey: ['services', 'assign', userScope],
  });

  const removeMutation = useMutation({
    mutationFn: accessService.removeAssignment,
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

  useEffect(() => {
    feedbackSeededDeviceIds.current = new Set(feedbackRecords.map((record) => record.deviceId));
  }, [feedbackRecords]);

  useEffect(() => {
    if (!servicesStateQuery.isFetchedAfterMount) {
      return;
    }

    const configuredFeedbackDevices = devices.filter(
      (device) => device.module === 'feedback' && device.configured,
    );

    const newRecords = configuredFeedbackDevices.flatMap((device) => {
      const alreadyPersisted = feedbackRecords.some((record) => record.deviceId === device.id);

      if (feedbackSeededDeviceIds.current.has(device.id) || alreadyPersisted) {
        feedbackSeededDeviceIds.current.add(device.id);
        return [];
      }

      feedbackSeededDeviceIds.current.add(device.id);
      return buildFeedbackSeed(device.id, 90);
    });

    if (newRecords.length === 0) {
      return;
    }

    const nextState = {
      ...servicesState,
      feedbackRecords: [...feedbackRecords, ...newRecords],
    };

    queryClient.setQueryData(queryKeys.services.state(userScope), nextState);
    saveServicesStateMutation.mutate(nextState);
  }, [
    devices,
    feedbackRecords,
    servicesState,
    servicesStateQuery.isFetchedAfterMount,
    queryClient,
    saveServicesStateMutation,
    userScope,
  ]);

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
      assignIdentifier,
      removeAssignment,
      reassignIdentifier,
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
      assignIdentifier,
      removeAssignment,
      reassignIdentifier,
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
