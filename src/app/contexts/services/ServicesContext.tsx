import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { buildFeedbackSeed, moduleActionLabels, seedEmployees, seedHistory } from '@/app/data';
import { createId } from '@/app/services';
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
  assignIdentifier: (input: AssignIdentifierInput) => void;
  removeAssignment: (assignmentId: string) => void;
  reassignIdentifier: (input: ReassignIdentifierInput) => void;
  getAssignmentsByModule: (module: ModuleKey) => ServiceAssignment[];
  getHistoryByModule: (module?: ModuleKey) => HistoryEvent[];
  getHistoryByDevice: (deviceId: string, module?: ModuleKey) => HistoryEvent[];
  getEmployeeById: (employeeId: string) => Employee | undefined;
}

const ServicesContext = createContext<ServicesContextValue | undefined>(undefined);

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

export function ServicesProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(seedEmployees);
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>(seedHistory);
  const [feedbackRecords, setFeedbackRecords] = useState<FeedbackRecord[]>([]);

  const feedbackSeededDeviceIds = useRef(new Set<string>());

  const {
    devices,
    assignIdentifierToEmployee,
    releaseIdentifier,
    getInventoryById,
  } = useMarketplace();
  const { addNotification } = useNotifications();

  useEffect(() => {
    const configuredFeedbackDevices = devices.filter(
      (device) => device.module === 'feedback' && device.configured,
    );

    configuredFeedbackDevices.forEach((device) => {
      if (feedbackSeededDeviceIds.current.has(device.id)) {
        return;
      }

      feedbackSeededDeviceIds.current.add(device.id);
      setFeedbackRecords((currentRecords) => [...currentRecords, ...buildFeedbackSeed(device.id, 90)]);
    });
  }, [devices]);

  const upsertEmployee = useCallback((firstName: string, lastName: string): Employee => {
    const normalizedFirstName = normalizeName(firstName);
    const normalizedLastName = normalizeName(lastName);

    let selectedEmployee: Employee | undefined;

    setEmployees((currentEmployees) => {
      selectedEmployee = currentEmployees.find(
        (employee) =>
          normalizeName(employee.firstName) === normalizedFirstName &&
          normalizeName(employee.lastName) === normalizedLastName,
      );

      if (selectedEmployee) {
        return currentEmployees;
      }

      const newEmployee: Employee = {
        id: createId('emp'),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: `${firstName.trim()} ${lastName.trim()}`,
      };

      selectedEmployee = newEmployee;
      return [newEmployee, ...currentEmployees];
    });

    if (!selectedEmployee) {
      throw new Error('Impossible de preparer l employee.');
    }

    return selectedEmployee;
  }, []);

  const appendHistory = useCallback(
    (entry: Omit<HistoryEvent, 'id' | 'occurredAt'>) => {
      const event: HistoryEvent = {
        id: createId('hist'),
        occurredAt: new Date().toISOString(),
        ...entry,
      };

      setHistory((currentHistory) => [event, ...currentHistory]);
    },
    [],
  );

  const assignIdentifier = useCallback(
    (input: AssignIdentifierInput) => {
      const device = devices.find((candidate) => candidate.id === input.deviceId && candidate.module === input.module);

      if (!device) {
        throw new Error('Boitier introuvable pour ce module.');
      }

      if (!device.configured) {
        throw new Error('Configurez ce boitier avant l attribution.');
      }

      const employee = upsertEmployee(input.firstName, input.lastName);

      const alreadyAssignedForEmployee = assignments.find(
        (assignment) => assignment.module === input.module && assignment.employeeId === employee.id,
      );

      if (alreadyAssignedForEmployee) {
        throw new Error('Cet employee possede deja un identifiant sur ce module.');
      }

      const assignedIdentifier = assignIdentifierToEmployee({
        module: input.module,
        deviceId: input.deviceId,
        identifierId: input.identifierId,
        employeeId: employee.id,
      });

      const assignment: ServiceAssignment = {
        id: createId('asn'),
        module: input.module,
        deviceId: input.deviceId,
        identifierId: input.identifierId,
        employeeId: employee.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setAssignments((currentAssignments) => [assignment, ...currentAssignments]);

      appendHistory({
        module: input.module,
        deviceId: device.id,
        employee: employee.fullName,
        identifier: assignedIdentifier.code,
        device: device.name,
        action: moduleActionLabels[input.module].assign,
      });

      addNotification({
        title: 'Identifiant assigne',
        message: `${assignedIdentifier.code} associe a ${employee.fullName} sur ${device.name}.`,
        module: input.module,
        kind: 'success',
        withToast: true,
      });
    },
    [devices, assignments, upsertEmployee, assignIdentifierToEmployee, appendHistory, addNotification],
  );

  const removeAssignment = useCallback(
    (assignmentId: string) => {
      const assignment = assignments.find((currentAssignment) => currentAssignment.id === assignmentId);

      if (!assignment) {
        throw new Error('Association introuvable.');
      }

      const employee = employees.find((candidate) => candidate.id === assignment.employeeId);
      const device = devices.find((candidate) => candidate.id === assignment.deviceId);
      const identifier = getInventoryById(assignment.identifierId);

      if (!employee || !device || !identifier) {
        throw new Error('Donnees incompletes pour retirer cette association.');
      }

      releaseIdentifier(assignment.identifierId);
      setAssignments((currentAssignments) =>
        currentAssignments.filter((currentAssignment) => currentAssignment.id !== assignmentId),
      );

      appendHistory({
        module: assignment.module,
        deviceId: device.id,
        employee: employee.fullName,
        identifier: identifier.code,
        device: device.name,
        action: moduleActionLabels[assignment.module].remove,
      });

      addNotification({
        title: 'Association retiree',
        message: `${identifier.code} est redevenu disponible.`,
        module: assignment.module,
        kind: 'warning',
        withToast: true,
      });
    },
    [assignments, employees, devices, getInventoryById, releaseIdentifier, appendHistory, addNotification],
  );

  const reassignIdentifier = useCallback(
    (input: ReassignIdentifierInput) => {
      const existingAssignment = assignments.find(
        (currentAssignment) => currentAssignment.id === input.assignmentId,
      );

      if (!existingAssignment) {
        throw new Error('Association introuvable pour la reattribution.');
      }

      const targetDevice = devices.find((device) => device.id === input.deviceId);

      if (!targetDevice || !targetDevice.configured || targetDevice.module !== existingAssignment.module) {
        throw new Error('Boitier cible invalide.');
      }

      const employee = upsertEmployee(input.firstName, input.lastName);
      const duplicateEmployeeAssignment = assignments.find(
        (assignment) =>
          assignment.module === existingAssignment.module &&
          assignment.employeeId === employee.id &&
          assignment.id !== existingAssignment.id,
      );

      if (duplicateEmployeeAssignment) {
        throw new Error('Cet employee possede deja un identifiant sur ce module.');
      }

      const currentIdentifier = getInventoryById(existingAssignment.identifierId);

      if (!currentIdentifier) {
        throw new Error('Identifiant indisponible.');
      }

      releaseIdentifier(existingAssignment.identifierId);
      const reassignedIdentifier = assignIdentifierToEmployee({
        module: existingAssignment.module,
        deviceId: input.deviceId,
        identifierId: existingAssignment.identifierId,
        employeeId: employee.id,
      });

      setAssignments((currentAssignments) =>
        currentAssignments.map((assignment) =>
          assignment.id === input.assignmentId
            ? {
                ...assignment,
                employeeId: employee.id,
                deviceId: input.deviceId,
                updatedAt: new Date().toISOString(),
              }
            : assignment,
        ),
      );

      appendHistory({
        module: existingAssignment.module,
        deviceId: targetDevice.id,
        employee: employee.fullName,
        identifier: reassignedIdentifier.code,
        device: targetDevice.name,
        action: 'Reattribution identifiant',
      });

      addNotification({
        title: 'Identifiant reattribue',
        message: `${reassignedIdentifier.code} est maintenant lie a ${employee.fullName}.`,
        module: existingAssignment.module,
        kind: 'success',
        withToast: true,
      });
    },
    [
      assignments,
      devices,
      upsertEmployee,
      getInventoryById,
      releaseIdentifier,
      assignIdentifierToEmployee,
      appendHistory,
      addNotification,
    ],
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
