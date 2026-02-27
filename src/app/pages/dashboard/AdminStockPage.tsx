import { AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import readXlsxFile from 'read-excel-file/browser';
import { useAuth, useI18n } from '@/app/contexts';
import {
  adminService,
  type AdminBulkDeviceItem,
  type AdminDeviceInventoryQuery,
  type OutboxEventType,
  type DeviceImportValidationResponse,
  type HardwareSystemCode,
  type IdentifierType,
} from '@/app/services';
import { EmptyState, PageHeader } from '@/app/shared/components';

const SYSTEM_CODE_OPTIONS: HardwareSystemCode[] = [
  'RFID_PRESENCE',
  'RFID_PORTE',
  'BIOMETRIE',
  'FEEDBACK',
];

const WEBHOOK_EVENT_OPTIONS: OutboxEventType[] = [
  'ORDER_ALLOCATED',
  'STOCK_LOW',
  'DEVICE_ACTIVATED',
  'RESERVATION_RELEASED',
];

const DEFAULT_SYSTEM_PRICING: Record<
  HardwareSystemCode,
  { deviceUnitPriceCents: number; extensionUnitPriceCents: number; currency: string }
> = {
  RFID_PRESENCE: { deviceUnitPriceCents: 21000, extensionUnitPriceCents: 1000, currency: 'XOF' },
  RFID_PORTE: { deviceUnitPriceCents: 20000, extensionUnitPriceCents: 1000, currency: 'XOF' },
  BIOMETRIE: { deviceUnitPriceCents: 20000, extensionUnitPriceCents: 1000, currency: 'XOF' },
  FEEDBACK: { deviceUnitPriceCents: 15000, extensionUnitPriceCents: 0, currency: 'XOF' },
};

type ProvisionMode = 'manual' | 'csv';

const SYSTEM_IDENTIFIER_TYPE_MAP: Record<
  Exclude<HardwareSystemCode, 'FEEDBACK'>,
  IdentifierType
> = {
  RFID_PRESENCE: 'BADGE',
  RFID_PORTE: 'SERRURE',
  BIOMETRIE: 'EMPREINTE',
};

interface SystemPricingDraft {
  deviceUnitPriceCents: string;
  extensionUnitPriceCents: string;
  currency: string;
}

const MAC_ADDRESS_REGEX = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
const GENERIC_IDENTIFIER_REGEX = /^[A-Z0-9][A-Z0-9:_-]{1,119}$/;

function normalizeSpreadsheetCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).trim();
}

async function parseXlsxRows(file: File): Promise<string[][]> {
  const rows = await readXlsxFile(file);
  return rows
    .map((row) =>
      row
        .map((entry) => normalizeSpreadsheetCell(entry))
        .filter((entry) => entry.length > 0),
    )
    .filter((row) => row.length > 0);
}

function parseRows(text: string): AdminBulkDeviceItem[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line
        .split(/[;,]/)
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      const [macAddress, ...identifiers] = parts;
      const normalizedIdentifiers = identifiers
        .map((identifier) => normalizePhysicalIdentifierInput(identifier))
        .filter((identifier) => identifier.length > 0);
      return {
        macAddress: normalizeMacInput(macAddress ?? ''),
        identifiers: normalizedIdentifiers.length > 0 ? normalizedIdentifiers : undefined,
      };
    });
}

function parseExtensionRows(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line
        .split(/[;,]/)
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      return normalizePhysicalIdentifierInput(parts[0] ?? '');
    })
    .filter((identifier) => identifier.length > 0);
}

function normalizeMacInput(value: string): string {
  return value.trim().toUpperCase().replace(/-/g, ':');
}

function normalizePhysicalIdentifierInput(value: string): string {
  const normalized = value.trim().toUpperCase();
  const normalizedAsMac = normalized.replace(/-/g, ':');
  if (MAC_ADDRESS_REGEX.test(normalizedAsMac)) {
    return normalizedAsMac;
  }
  return normalized;
}

function isValidPhysicalIdentifier(value: string): boolean {
  return MAC_ADDRESS_REGEX.test(value) || GENERIC_IDENTIFIER_REGEX.test(value);
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatAuditDetails(details: unknown): string | null {
  if (details === null || details === undefined) {
    return null;
  }
  try {
    const serialized = JSON.stringify(details);
    return serialized.length > 160 ? `${serialized.slice(0, 157)}...` : serialized;
  } catch {
    return String(details);
  }
}

function formatMoneyFromCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cents);
  } catch {
    return `${cents} ${currency}`;
  }
}

export function AdminStockPage() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { user } = useAuth();
  const role = user?.roleName?.trim().toLowerCase();
  const isAdmin = role === 'admin';
  const canManageStock = isAdmin;

  const getIdentifierTypeLabel = (type?: IdentifierType | null) => {
    if (type === 'EMPREINTE') {
      return t('identifier.empreinte');
    }
    if (type === 'SERRURE') {
      return t('identifier.serrure-rfid');
    }
    return t('identifier.badge-rfid');
  };

  const [importSystemId, setImportSystemId] = useState('');
  const [importWarehouseCode, setImportWarehouseCode] = useState('MAIN');
  const [provisionMode, setProvisionMode] = useState<ProvisionMode>('manual');
  const [manualMacAddress, setManualMacAddress] = useState('');
  const [manualIdentifierInput, setManualIdentifierInput] = useState('');
  const [manualIdentifiers, setManualIdentifiers] = useState<string[]>([]);
  const [manualBatchDevices, setManualBatchDevices] = useState<AdminBulkDeviceItem[]>([]);
  const [importRawInput, setImportRawInput] = useState('');
  const [importValidation, setImportValidation] = useState<DeviceImportValidationResponse | null>(null);
  const [extensionSystemId, setExtensionSystemId] = useState('');
  const [extensionWarehouseCode, setExtensionWarehouseCode] = useState('MAIN');
  const [extensionProvisionMode, setExtensionProvisionMode] = useState<ProvisionMode>('manual');
  const [manualExtensionInput, setManualExtensionInput] = useState('');
  const [manualExtensionBatch, setManualExtensionBatch] = useState<string[]>([]);
  const [extensionRawInput, setExtensionRawInput] = useState('');

  const [inventoryFilters, setInventoryFilters] = useState<AdminDeviceInventoryQuery>({
    page: 1,
    limit: 12,
    search: '',
    warehouseCode: '',
  });
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const [createSystemPayload, setCreateSystemPayload] = useState({
    name: '',
    code: 'RFID_PRESENCE' as HardwareSystemCode,
    hasIdentifiers: true,
    identifiersPerDevice: 5,
    identifierType: 'BADGE' as IdentifierType,
    deviceUnitPriceCents: DEFAULT_SYSTEM_PRICING.RFID_PRESENCE.deviceUnitPriceCents,
    extensionUnitPriceCents: DEFAULT_SYSTEM_PRICING.RFID_PRESENCE.extensionUnitPriceCents,
    currency: DEFAULT_SYSTEM_PRICING.RFID_PRESENCE.currency,
    isActive: true,
  });
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    eventType: 'ORDER_ALLOCATED' as OutboxEventType,
    secret: '',
  });
  const [pendingWebhookAction, setPendingWebhookAction] = useState<{
    webhookId: string;
    type: 'toggle' | 'test';
  } | null>(null);
  const [pricingDraftsBySystemId, setPricingDraftsBySystemId] = useState<
    Record<string, SystemPricingDraft>
  >({});
  const [pendingPricingSystemId, setPendingPricingSystemId] = useState<string | null>(null);

  const systemsQuery = useQuery({
    queryKey: ['admin', 'systems'],
    queryFn: adminService.listSystems,
    enabled: canManageStock,
  });

  const systems = systemsQuery.data ?? [];
  useEffect(() => {
    const nextDrafts = systems.reduce<Record<string, SystemPricingDraft>>((accumulator, system) => {
      accumulator[system.id] = {
        deviceUnitPriceCents: String(system.deviceUnitPriceCents),
        extensionUnitPriceCents: String(system.extensionUnitPriceCents),
        currency: system.currency,
      };
      return accumulator;
    }, {});
    setPricingDraftsBySystemId(nextDrafts);
  }, [systems]);

  const selectedImportSystem = useMemo(
    () => systems.find((system) => system.id === importSystemId) ?? null,
    [systems, importSystemId],
  );
  const extensionCapableSystems = useMemo(
    () => systems.filter((system) => system.hasIdentifiers && system.code !== 'FEEDBACK'),
    [systems],
  );
  const selectedExtensionSystem = useMemo(
    () => extensionCapableSystems.find((system) => system.id === extensionSystemId) ?? null,
    [extensionCapableSystems, extensionSystemId],
  );
  const expectedCreateIdentifierType =
    createSystemPayload.code === 'FEEDBACK'
      ? null
      : SYSTEM_IDENTIFIER_TYPE_MAP[
          createSystemPayload.code as Exclude<HardwareSystemCode, 'FEEDBACK'>
        ];
  const requiredIdentifiersPerDevice = selectedImportSystem?.hasIdentifiers
    ? selectedImportSystem.identifiersPerDevice
    : 0;
  const selectedImportIdentifierLabel = selectedImportSystem
    ? getIdentifierTypeLabel(selectedImportSystem.identifierType)
    : getIdentifierTypeLabel();
  const selectedExtensionIdentifierLabel = selectedExtensionSystem
    ? getIdentifierTypeLabel(selectedExtensionSystem.identifierType)
    : getIdentifierTypeLabel();
  const parsedCsvRows = useMemo(() => parseRows(importRawInput), [importRawInput]);
  const draftRows = provisionMode === 'manual' ? manualBatchDevices : parsedCsvRows;
  const parsedExtensionCsvRows = useMemo(
    () => parseExtensionRows(extensionRawInput),
    [extensionRawInput],
  );
  const extensionDraftIdentifiers =
    extensionProvisionMode === 'manual' ? manualExtensionBatch : parsedExtensionCsvRows;
  const duplicateExtensionIdentifiers = useMemo(() => {
    const counts = extensionDraftIdentifiers.reduce<Record<string, number>>((accumulator, identifier) => {
      accumulator[identifier] = (accumulator[identifier] ?? 0) + 1;
      return accumulator;
    }, {});
    return Object.entries(counts)
      .filter(([, count]) => count > 1)
      .map(([identifier]) => identifier);
  }, [extensionDraftIdentifiers]);
  const invalidExtensionIdentifiers = useMemo(
    () => extensionDraftIdentifiers.filter((identifier) => !isValidPhysicalIdentifier(identifier)),
    [extensionDraftIdentifiers],
  );
  const readyExtensionCount = useMemo(() => {
    const uniqueIdentifiers = new Set(extensionDraftIdentifiers);
    return Array.from(uniqueIdentifiers).filter((identifier) => isValidPhysicalIdentifier(identifier))
      .length;
  }, [extensionDraftIdentifiers]);

  const lowStockAlertsQuery = useQuery({
    queryKey: ['admin', 'inventory', 'alerts'],
    queryFn: adminService.listLowStockAlerts,
    enabled: canManageStock,
    refetchInterval: 60_000,
  });

  const inventoryQuery = useQuery({
    queryKey: ['admin', 'inventory', 'devices', inventoryFilters],
    queryFn: () => adminService.listInventoryDevices(inventoryFilters),
    enabled: canManageStock,
  });

  const adminLogsQuery = useQuery({
    queryKey: ['admin', 'logs'],
    queryFn: () => adminService.listAdminLogs({ page: 1, limit: 8 }),
    enabled: canManageStock,
  });

  const webhooksQuery = useQuery({
    queryKey: ['admin', 'webhooks'],
    queryFn: adminService.listWebhooks,
    enabled: canManageStock,
  });
  const webhooks = webhooksQuery.data ?? [];
  const activeWebhooks = webhooks.filter((webhook) => webhook.isActive).length;
  const failingWebhooks = webhooks.filter((webhook) => webhook.failureCount > 0).length;

  const deviceDetailQuery = useQuery({
    queryKey: ['admin', 'inventory', 'device', selectedDeviceId],
    queryFn: () => adminService.getInventoryDevice(selectedDeviceId as string),
    enabled: canManageStock && Boolean(selectedDeviceId),
  });

  const totalInventoryPages = useMemo(() => {
    const total = inventoryQuery.data?.total ?? 0;
    const limit = Number(inventoryFilters.limit ?? 12);
    return Math.max(1, Math.ceil(total / Math.max(limit, 1)));
  }, [inventoryFilters.limit, inventoryQuery.data?.total]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin'] }),
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'catalog'] }),
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'state'] }),
    ]);
  };

  const createSystemMutation = useMutation({
    mutationFn: adminService.createSystem,
    onSuccess: async () => {
      toast.success(t('adminStock.toast.systemCreated'));
      await refreshAll();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('adminStock.toast.creationImpossible')),
  });

  const toggleSystemMutation = useMutation({
    mutationFn: ({ systemId, isActive }: { systemId: string; isActive: boolean }) =>
      adminService.updateSystemActivation(systemId, isActive),
    onSuccess: async () => {
      toast.success(t('adminStock.toast.systemActivationUpdated'));
      await refreshAll();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('adminStock.toast.updateImpossible')),
  });

  const updateSystemPricingMutation = useMutation({
    mutationFn: ({
      systemId,
      payload,
    }: {
      systemId: string;
      payload: {
        deviceUnitPriceCents: number;
        extensionUnitPriceCents: number;
        currency: string;
      };
    }) => adminService.updateSystemPricing(systemId, payload),
    onMutate: ({ systemId }) => {
      setPendingPricingSystemId(systemId);
    },
    onSuccess: async () => {
      toast.success(t('adminStock.toast.pricingUpdated'));
      await refreshAll();
    },
    onSettled: () => {
      setPendingPricingSystemId(null);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('adminStock.toast.pricingUpdateImpossible')),
  });

  const validateImportMutation = useMutation({
    mutationFn: ({ systemId, rows }: { systemId: string; rows: AdminBulkDeviceItem[] }) =>
      adminService.validateDevicesImport(systemId, {
        devices: rows,
        warehouseCode: importWarehouseCode || undefined,
      }),
    onSuccess: (result) => {
      setImportValidation(result);
      toast[result.canCommit ? 'success' : 'warning'](
        result.canCommit
          ? t('adminStock.toast.validationCompletedValid')
          : t('adminStock.toast.validationCompletedWithErrors'),
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('adminStock.toast.validationImpossible')),
  });

  const createDevicesMutation = useMutation({
    mutationFn: ({
      systemId,
      devices,
      warehouseCode,
    }: {
      systemId: string;
      devices: AdminBulkDeviceItem[];
      warehouseCode?: string;
    }) =>
      adminService.createDevicesBulk(systemId, {
        quantity: devices.length,
        devices,
        warehouseCode,
      }),
    onSuccess: async (response) => {
      toast.success(t('adminStock.toast.devicesAdded', { count: Number(response.created ?? 0) }));
      setImportValidation(null);
      setImportRawInput('');
      setManualMacAddress('');
      setManualIdentifierInput('');
      setManualIdentifiers([]);
      setManualBatchDevices([]);
      await refreshAll();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('adminStock.toast.stockAddImpossible')),
  });

  const createExtensionsMutation = useMutation({
    mutationFn: ({
      systemId,
      identifiers,
      type,
      warehouseCode,
    }: {
      systemId: string;
      identifiers: string[];
      type?: IdentifierType;
      warehouseCode?: string;
    }) =>
      adminService.createSystemIdentifiersBulk(systemId, {
        type,
        physicalIdentifiers: identifiers,
        warehouseCode,
      }),
    onSuccess: async (response) => {
      toast.success(t('adminStock.toast.extensionsAdded', { count: Number(response.created ?? 0) }));
      setManualExtensionInput('');
      setManualExtensionBatch([]);
      setExtensionRawInput('');
      await refreshAll();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('adminStock.toast.extensionsAddImpossible')),
  });

  const createWebhookMutation = useMutation({
    mutationFn: () =>
      adminService.createWebhook({
        name: webhookForm.name.trim(),
        url: webhookForm.url.trim(),
        events: [webhookForm.eventType],
        secret: webhookForm.secret.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success(t('adminStock.toast.webhookCreated'));
      setWebhookForm((prev) => ({ ...prev, name: '', url: '', secret: '' }));
      await queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('adminStock.toast.webhookCreationImpossible')),
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: ({ webhookId, isActive }: { webhookId: string; isActive: boolean }) =>
      adminService.updateWebhookActivation(webhookId, isActive),
    onMutate: ({ webhookId }) => {
      setPendingWebhookAction({ webhookId, type: 'toggle' });
    },
    onSuccess: async () => {
      toast.success(t('adminStock.toast.webhookActivationUpdated'));
      await queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] });
    },
    onSettled: () => {
      setPendingWebhookAction(null);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('adminStock.toast.webhookUpdateImpossible')),
  });

  const testWebhookMutation = useMutation({
    mutationFn: ({ webhookId, eventType }: { webhookId: string; eventType?: OutboxEventType }) =>
      adminService.testWebhook(webhookId, eventType),
    onMutate: ({ webhookId }) => {
      setPendingWebhookAction({ webhookId, type: 'test' });
    },
    onSuccess: () => {
      toast.success(t('adminStock.toast.webhookTestSent'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'logs'] });
    },
    onSettled: () => {
      setPendingWebhookAction(null);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('adminStock.toast.webhookTestImpossible')),
  });

  const resetProvisionDraft = () => {
    setImportValidation(null);
    setManualMacAddress('');
    setManualIdentifierInput('');
    setManualIdentifiers([]);
    setManualBatchDevices([]);
    setImportRawInput('');
  };

  const resetExtensionDraft = () => {
    setManualExtensionInput('');
    setManualExtensionBatch([]);
    setExtensionRawInput('');
  };

  const handleImportSystemChange = (nextSystemId: string) => {
    setImportSystemId(nextSystemId);
    resetProvisionDraft();
  };

  const handleProvisionModeChange = (nextMode: ProvisionMode) => {
    setProvisionMode(nextMode);
    setImportValidation(null);
  };

  const handleExtensionSystemChange = (nextSystemId: string) => {
    setExtensionSystemId(nextSystemId);
    resetExtensionDraft();
  };

  const handleExtensionProvisionModeChange = (nextMode: ProvisionMode) => {
    setExtensionProvisionMode(nextMode);
  };

  const handleAddManualIdentifier = () => {
    if (!selectedImportSystem || !selectedImportSystem.hasIdentifiers) {
      return;
    }

    if (requiredIdentifiersPerDevice <= 0) {
      return;
    }

    if (manualIdentifiers.length >= requiredIdentifiersPerDevice) {
      toast.error(
        t('adminStock.toast.maxExtensionsPerDevice', { count: requiredIdentifiersPerDevice }),
      );
      return;
    }

    const normalizedIdentifier = normalizePhysicalIdentifierInput(manualIdentifierInput);
    if (!normalizedIdentifier) {
      toast.error(t('adminStock.toast.enterExtensionIdentifier'));
      return;
    }

    if (!isValidPhysicalIdentifier(normalizedIdentifier)) {
      toast.error(
        'Identifiant invalide. Utilisez une MAC (AA:BB:CC:DD:EE:FF) ou un code alphanumerique (A-Z, 0-9, -, _, :).',
      );
      return;
    }

    if (manualIdentifiers.includes(normalizedIdentifier)) {
      toast.error(t('adminStock.toast.duplicateExtensionForDevice'));
      return;
    }

    setManualIdentifiers((prev) => [...prev, normalizedIdentifier]);
    setManualIdentifierInput('');
  };

  const handleRemoveManualIdentifier = (identifier: string) => {
    setManualIdentifiers((prev) => prev.filter((entry) => entry !== identifier));
  };

  const handleAddManualDevice = () => {
    if (!importSystemId) {
      toast.error(t('adminStock.toast.selectTargetSystem'));
      return;
    }

    const normalizedMacAddress = normalizeMacInput(manualMacAddress);
    if (!normalizedMacAddress) {
      toast.error(t('adminStock.toast.macRequired'));
      return;
    }

    if (
      manualBatchDevices.some(
        (device) => normalizeMacInput(device.macAddress) === normalizedMacAddress,
      )
    ) {
      toast.error(t('adminStock.toast.deviceAlreadyInBatch'));
      return;
    }

    if (selectedImportSystem?.hasIdentifiers && manualIdentifiers.length !== requiredIdentifiersPerDevice) {
      toast.error(
        t('adminStock.toast.requiredExtensionsForSystem', {
          count: requiredIdentifiersPerDevice,
          system: selectedImportSystem.name,
        }),
      );
      return;
    }

    setManualBatchDevices((prev) => [
      ...prev,
      {
        macAddress: normalizedMacAddress,
        identifiers:
          selectedImportSystem?.hasIdentifiers && manualIdentifiers.length > 0
            ? manualIdentifiers
            : undefined,
      },
    ]);
    setManualMacAddress('');
    setManualIdentifierInput('');
    setManualIdentifiers([]);
    setImportValidation(null);
  };

  const handleRemoveManualDevice = (index: number) => {
    setManualBatchDevices((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    setImportValidation(null);
  };

  const handleAddManualExtension = () => {
    if (!selectedExtensionSystem) {
      toast.error(t('adminStock.toast.selectExtensionSystem'));
      return;
    }

    const normalizedIdentifier = normalizePhysicalIdentifierInput(manualExtensionInput);
    if (!normalizedIdentifier) {
      toast.error(t('adminStock.toast.enterExtensionIdentifier'));
      return;
    }

    if (!isValidPhysicalIdentifier(normalizedIdentifier)) {
      toast.error(
        'Identifiant invalide. Utilisez une MAC (AA:BB:CC:DD:EE:FF) ou un code alphanumerique (A-Z, 0-9, -, _, :).',
      );
      return;
    }

    if (manualExtensionBatch.includes(normalizedIdentifier)) {
      toast.error(t('adminStock.toast.duplicateExtensionInBatch'));
      return;
    }

    setManualExtensionBatch((prev) => [...prev, normalizedIdentifier]);
    setManualExtensionInput('');
  };

  const handleRemoveManualExtension = (identifier: string) => {
    setManualExtensionBatch((prev) => prev.filter((entry) => entry !== identifier));
  };

  const handleExtensionImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const lowerName = file.name.toLowerCase();
      let content = '';

      if (lowerName.endsWith('.xlsx')) {
        const normalizedRows = await parseXlsxRows(file);
        if (normalizedRows.length === 0) {
          toast.error(t('adminStock.toast.xlsxNoSheet'));
          return;
        }

        const maybeHeader = normalizedRows[0]?.[0]?.toLowerCase() ?? '';
        const dataRows =
          maybeHeader.includes('extension') || maybeHeader.includes('identifier')
            ? normalizedRows.slice(1)
            : normalizedRows;
        content = dataRows.map((row) => row[0] ?? '').join('\n');
      } else {
        content = await file.text();
      }

      if (!content.trim()) {
        toast.error(t('adminStock.toast.fileEmptyAfterRead'));
        return;
      }

      setExtensionRawInput(content);
      toast.success(t('adminStock.toast.extensionsFileLoaded', { file: file.name }));
    } catch {
      toast.error(t('adminStock.toast.extensionsFileReadImpossible'));
    }
  };

  const handleConfirmExtensions = () => {
    if (!selectedExtensionSystem) {
      toast.error(t('adminStock.toast.selectExtensionSystem'));
      return;
    }

    if (extensionDraftIdentifiers.length === 0) {
      toast.error(t('adminStock.toast.addAtLeastOneExtension'));
      return;
    }

    if (duplicateExtensionIdentifiers.length > 0) {
      toast.error(t('adminStock.toast.batchContainsDuplicates'));
      return;
    }

    if (invalidExtensionIdentifiers.length > 0) {
      toast.error('Le lot contient des identifiants invalides.');
      return;
    }

    createExtensionsMutation.mutate({
      systemId: selectedExtensionSystem.id,
      identifiers: extensionDraftIdentifiers,
      type: (selectedExtensionSystem.identifierType ?? undefined) as IdentifierType | undefined,
      warehouseCode: extensionWarehouseCode || undefined,
    });
  };

  const handleVerifyImport = () => {
    if (!importSystemId) {
      toast.error(t('adminStock.toast.selectTargetSystem'));
      return;
    }
    if (provisionMode === 'manual' && manualMacAddress.trim()) {
      toast.error(t('adminStock.toast.addCurrentDeviceBeforeVerify'));
      return;
    }
    const rows = draftRows;
    if (rows.length === 0) {
      toast.error(t('adminStock.toast.addAtLeastOneRow'));
      return;
    }
    validateImportMutation.mutate({ systemId: importSystemId, rows });
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const lowerName = file.name.toLowerCase();
      let content = '';

      if (lowerName.endsWith('.xlsx')) {
        const normalizedRows = await parseXlsxRows(file);
        if (normalizedRows.length === 0) {
          toast.error(t('adminStock.toast.xlsxNoSheet'));
          return;
        }

        const maybeHeader = normalizedRows[0]?.[0]?.toLowerCase() ?? '';
        const dataRows = maybeHeader.includes('mac') ? normalizedRows.slice(1) : normalizedRows;
        content = dataRows.map((row) => row.join(',')).join('\n');
      } else {
        content = await file.text();
      }

      if (!content.trim()) {
        toast.error(t('adminStock.toast.fileEmptyAfterRead'));
        return;
      }

      setImportRawInput(content);
      toast.success(t('adminStock.toast.fileLoaded', { file: file.name }));
    } catch {
      toast.error(t('adminStock.toast.fileReadImpossible'));
    }
  };

  const handleConfirmImport = () => {
    if (!importSystemId || !importValidation?.canCommit) {
      toast.error(t('adminStock.toast.validateBeforeConfirm'));
      return;
    }
    const devices = importValidation.rows
      .filter((row) => row.issues.length === 0)
      .map((row) => ({
        macAddress: row.macAddress,
        identifiers: row.identifiers.length > 0 ? row.identifiers : undefined,
        warehouseCode: row.warehouseCode,
      }));
    if (devices.length === 0) {
      toast.error(t('adminStock.toast.noValidDeviceToConfirm'));
      return;
    }
    createDevicesMutation.mutate({
      systemId: importSystemId,
      devices,
      warehouseCode: importWarehouseCode || undefined,
    });
  };

  const handleCreateSystem = () => {
    if (!isAdmin) {
      toast.error(t('adminStock.toast.onlyAdminCreateSystem'));
      return;
    }

    if (!createSystemPayload.name.trim()) {
      toast.error(t('adminStock.toast.systemNameRequired'));
      return;
    }

    const normalizedCurrency = createSystemPayload.currency.trim().toUpperCase();
    if (normalizedCurrency.length !== 3) {
      toast.error(t('adminStock.toast.invalidCurrency'));
      return;
    }

    const isFeedbackSystem = createSystemPayload.code === 'FEEDBACK';
    const resolvedIdentifierType = isFeedbackSystem
      ? undefined
      : SYSTEM_IDENTIFIER_TYPE_MAP[
          createSystemPayload.code as Exclude<HardwareSystemCode, 'FEEDBACK'>
        ];
    createSystemMutation.mutate({
      name: createSystemPayload.name.trim(),
      code: createSystemPayload.code,
      hasIdentifiers: !isFeedbackSystem,
      identifiersPerDevice:
        !isFeedbackSystem ? createSystemPayload.identifiersPerDevice : 0,
      identifierType: resolvedIdentifierType,
      deviceUnitPriceCents: Math.max(0, Math.trunc(createSystemPayload.deviceUnitPriceCents)),
      extensionUnitPriceCents: isFeedbackSystem
        ? 0
        : Math.max(0, Math.trunc(createSystemPayload.extensionUnitPriceCents)),
      currency: normalizedCurrency,
      isActive: createSystemPayload.isActive,
    });
  };

  const handlePricingDraftChange = (
    systemId: string,
    field: keyof SystemPricingDraft,
    value: string,
  ) => {
    setPricingDraftsBySystemId((prev) => ({
      ...prev,
      [systemId]: {
        ...(prev[systemId] ?? {
          deviceUnitPriceCents: '0',
          extensionUnitPriceCents: '0',
          currency: 'XOF',
        }),
        [field]:
          field === 'currency'
            ? value.toUpperCase()
            : value.replace(/[^\d]/g, ''),
      },
    }));
  };

  const handleSaveSystemPricing = (systemId: string) => {
    const system = systems.find((entry) => entry.id === systemId);
    const draft = pricingDraftsBySystemId[systemId];

    if (!system || !draft) {
      toast.error(t('adminStock.toast.systemNotFoundForPricing'));
      return;
    }

    const deviceUnitPriceCents = Number.parseInt(draft.deviceUnitPriceCents, 10);
    const extensionInputValue = Number.parseInt(draft.extensionUnitPriceCents, 10);
    const currency = draft.currency.trim().toUpperCase();

    if (!Number.isInteger(deviceUnitPriceCents) || deviceUnitPriceCents < 0) {
      toast.error(t('adminStock.toast.invalidDevicePrice'));
      return;
    }

    if (
      system.code !== 'FEEDBACK' &&
      (!Number.isInteger(extensionInputValue) || extensionInputValue < 0)
    ) {
      toast.error(t('adminStock.toast.invalidExtensionPrice'));
      return;
    }

    if (currency.length !== 3) {
      toast.error(t('adminStock.toast.currencyMustBe3Chars'));
      return;
    }

    updateSystemPricingMutation.mutate({
      systemId,
      payload: {
        deviceUnitPriceCents,
        extensionUnitPriceCents: system.code === 'FEEDBACK' ? 0 : extensionInputValue,
        currency,
      },
    });
  };

  const handleCreateWebhook = () => {
    if (!webhookForm.name.trim() || !webhookForm.url.trim()) {
      toast.error(t('adminStock.toast.webhookNameUrlRequired'));
      return;
    }
    createWebhookMutation.mutate();
  };

  const importStep = useMemo(() => {
    if (createDevicesMutation.isPending) {
      return 3;
    }
    if (importValidation) {
      return 2;
    }
    return 1;
  }, [createDevicesMutation.isPending, importValidation]);

  const importIssuesPreview = useMemo(() => {
    if (!importValidation) {
      return [];
    }

    return importValidation.rows
      .flatMap((row) =>
        row.issues.map((issue) => ({
          rowNumber: row.rowNumber,
          code: issue.code,
          message: issue.message,
        })),
      )
      .slice(0, 5);
  }, [importValidation]);
  const selectedDeviceDetail = deviceDetailQuery.data?.device ?? null;
  const selectedDeviceMovements = deviceDetailQuery.data?.movements ?? [];
  const selectedDeviceLogs = deviceDetailQuery.data?.adminLogs ?? [];
  const selectedDeviceIdentifiers =
    selectedDeviceDetail?.system.code === 'FEEDBACK' ? [] : (selectedDeviceDetail?.identifiers ?? []);
  const canCreateWebhook = webhookForm.name.trim().length > 0 && webhookForm.url.trim().length > 0;

  if (!canManageStock) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('adminStock.title')}
          description={t('adminStock.restricted.description')}
        />
        <EmptyState
          title={t('adminStock.restricted.title')}
          description={t('adminStock.restricted.emptyDescription')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('adminStock.title')}
        description={t('adminStock.description')}
      />

      {(lowStockAlertsQuery.data ?? []).map((alert) => (
        <div
          key={`${alert.systemId}-${alert.warehouseCode}`}
          className={`alert ${alert.severity === 'critical' ? 'border-[var(--error-main)]/40 bg-[var(--error-main)]/10' : 'border-[var(--warning-main)]/40 bg-[var(--warning-main)]/10'}`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span>
            {t('adminStock.alert.lowStock', {
              system: alert.systemName,
              warehouse: alert.warehouseCode,
              devices: alert.availableDevices,
              extensions: alert.availableExtensions,
              deviceRestock: alert.recommendedDeviceRestock,
              extensionRestock: alert.recommendedExtensionRestock,
            })}
          </span>
        </div>
      ))}

      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${importStep >= 1 ? 'badge-info' : 'badge-outline'}`}>
              1. {t('adminStock.steps.import')}
            </span>
            <span className={`badge ${importStep >= 2 ? 'badge-info' : 'badge-outline'}`}>
              2. {t('adminStock.steps.verify')}
            </span>
            <span className={`badge ${importStep >= 3 ? 'badge-success' : 'badge-outline'}`}>
              3. {t('adminStock.steps.confirm')}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {t('adminStock.provisioning.title')}
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('adminStock.provisioning.description')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn btn-sm ${provisionMode === 'manual' ? 'btn-info text-[var(--app-bg)]' : 'btn-outline'}`}
              onClick={() => handleProvisionModeChange('manual')}
            >
              {t('adminStock.mode.manual')}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${provisionMode === 'csv' ? 'btn-info text-[var(--app-bg)]' : 'btn-outline'}`}
              onClick={() => handleProvisionModeChange('csv')}
            >
              {t('adminStock.mode.csv')}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">
                {t('adminStock.labels.system')}
              </span>
              <select
                className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                value={importSystemId}
                onChange={(event) => handleImportSystemChange(event.target.value)}
              >
                <option value="">{t('adminStock.labels.select')}</option>
                {systems.map((system) => (
                  <option key={system.id} value={system.id}>
                    {system.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">
                {t('adminStock.labels.warehouse')}
              </span>
              <input
                className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                value={importWarehouseCode}
                onChange={(event) => setImportWarehouseCode(event.target.value.toUpperCase())}
                placeholder="MAIN"
              />
            </label>
            <div className="text-xs text-[var(--text-secondary)]">
              {selectedImportSystem
                ? selectedImportSystem.hasIdentifiers
                  ? `${requiredIdentifiersPerDevice} identifiant(s) ${selectedImportIdentifierLabel} requis par boitier.`
                  : 'Aucun identifiant attendu pour ce systeme.'
                : 'Selectionnez un systeme.'}
            </div>
          </div>

          {provisionMode === 'manual' ? (
            <div className="space-y-4 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
              {selectedImportSystem ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="form-control">
                      <span className="label-text text-xs text-[var(--text-secondary)]">Adresse MAC du boitier</span>
                      <input
                        className="input input-bordered mt-1 bg-[var(--card-bg)] font-mono"
                        placeholder="AA:70:31:00:00:01"
                        value={manualMacAddress}
                        onChange={(event) => setManualMacAddress(event.target.value.toUpperCase())}
                      />
                    </label>
                    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--card-bg)] p-3">
                      <p className="text-xs text-[var(--text-secondary)]">Boitiers dans le lot</p>
                      <p className="text-xl font-semibold text-[var(--text-primary)]">
                        {manualBatchDevices.length}
                      </p>
                    </div>
                  </div>

                  {selectedImportSystem.hasIdentifiers ? (
                    <div className="space-y-3">
                      <p className="text-sm text-[var(--text-secondary)]">
                        {selectedImportIdentifierLabel} ({manualIdentifiers.length}/{requiredIdentifiersPerDevice})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <input
                          className="input input-bordered grow bg-[var(--card-bg)] font-mono"
                          placeholder={`Identifiant ${selectedImportIdentifierLabel}`}
                          value={manualIdentifierInput}
                          onChange={(event) =>
                            setManualIdentifierInput(normalizePhysicalIdentifierInput(event.target.value))
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleAddManualIdentifier();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-info"
                          onClick={handleAddManualIdentifier}
                          disabled={
                            !manualIdentifierInput.trim() ||
                            manualIdentifiers.length >= requiredIdentifiersPerDevice
                          }
                        >
                          OK
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {manualIdentifiers.length === 0 ? (
                          <p className="text-xs text-[var(--text-secondary)]">
                            Ajoutez les identifiants un a un.
                          </p>
                        ) : (
                          manualIdentifiers.map((identifier) => (
                            <button
                              key={identifier}
                              type="button"
                              className="badge badge-outline gap-2 px-2 py-3"
                              onClick={() => handleRemoveManualIdentifier(identifier)}
                              title="Retirer cette extension"
                            >
                              {identifier}
                              <span aria-hidden="true">x</span>
                            </button>
                          ))
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Format accepte: MAC (AA:BB:CC:DD:EE:FF) ou code alphanumerique (A-Z, 0-9, -, _, :).
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      Ce systeme ne demande aucune extension.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">
                  Selectionnez un systeme pour afficher la saisie MAC.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-info text-[var(--app-bg)]"
                  disabled={!importSystemId}
                  onClick={handleAddManualDevice}
                >
                  {t('adminStock.actions.addDevice')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setManualMacAddress('');
                    setManualIdentifierInput('');
                    setManualIdentifiers([]);
                  }}
                >
                  {t('adminStock.actions.resetInput')}
                </button>
              </div>

              {manualBatchDevices.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>MAC</th>
                        <th>Extensions</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualBatchDevices.map((device, index) => (
                        <tr key={`${device.macAddress}-${index}`}>
                          <td>{index + 1}</td>
                          <td className="font-mono text-xs">{device.macAddress}</td>
                          <td className="font-mono text-xs">
                            {(device.identifiers ?? []).join(', ') || '-'}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => handleRemoveManualDevice(index)}
                            >
                              Retirer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs text-[var(--text-secondary)]">
                Format attendu: MAC boitier puis identifiants. Exemple:
                {' '}
                {selectedImportSystem?.hasIdentifiers
                  ? 'AA:70:31:00:00:01,BADGE-001,BADGE-002,BADGE-003,BADGE-004,BADGE-005'
                  : 'AA:70:34:00:00:01'}
              </p>
              <input
                type="file"
                accept=".csv,.txt,.xlsx"
                className="file-input file-input-bordered file-input-sm w-full max-w-sm bg-[var(--card-bg)]"
                onChange={handleImportFile}
              />
              <textarea
                className="textarea textarea-bordered min-h-36 bg-[var(--card-bg)] font-mono text-xs"
                placeholder="AA:70:31:00:00:01,AA:70:31:00:10:01,AA:70:31:00:10:02,AA:70:31:00:10:03,AA:70:31:00:10:04,AA:70:31:00:10:05"
                value={importRawInput}
                onChange={(event) => setImportRawInput(event.target.value)}
              />
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Lignes detectees</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">{draftRows.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Lignes valides</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">{importValidation?.summary.validRows ?? '-'}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Lignes invalides</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">{importValidation?.summary.invalidRows ?? '-'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-info text-[var(--app-bg)]"
              disabled={validateImportMutation.isPending || createDevicesMutation.isPending}
              onClick={handleVerifyImport}
            >
              {validateImportMutation.isPending
                ? t('adminStock.actions.verifying')
                : t('adminStock.actions.verify')}
            </button>
            <button
              type="button"
              className="btn btn-success"
              disabled={!importValidation?.canCommit || createDevicesMutation.isPending}
              onClick={handleConfirmImport}
            >
              <CheckCircle2 className="h-4 w-4" />
              {createDevicesMutation.isPending
                ? t('adminStock.actions.confirming')
                : t('adminStock.actions.confirm')}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={resetProvisionDraft}
            >
              {t('adminStock.actions.clearBatch')}
            </button>
          </div>

          {importValidation && importIssuesPreview.length > 0 ? (
            <div className="rounded-lg border border-[var(--warning-main)]/40 bg-[var(--warning-main)]/10 p-3 text-sm">
              <p className="font-medium text-[var(--text-primary)]">
                Erreurs a corriger avant confirmation
              </p>
              <ul className="mt-2 space-y-1 text-[var(--text-secondary)]">
                {importIssuesPreview.map((issue) => (
                  <li key={`${issue.rowNumber}-${issue.code}`}>
                    Ligne {issue.rowNumber} - {issue.code}: {issue.message}
                  </li>
                ))}
              </ul>
              {importValidation.summary.invalidRows > importIssuesPreview.length ? (
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  +{importValidation.summary.invalidRows - importIssuesPreview.length} erreur(s) supplementaire(s) dans le tableau de verification.
                </p>
              ) : null}
            </div>
          ) : null}

          {importValidation?.canCommit ? (
            <div className="rounded-lg border border-[var(--success-main)]/40 bg-[var(--success-main)]/10 p-3 text-sm text-[var(--text-primary)]">
              Lot valide. Cliquez sur <strong>Confirmer</strong> pour rendre ce materiel vendable dans le marketplace.
            </div>
          ) : null}

          {importValidation ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>MAC</th>
                    <th>Entrepot</th>
                    <th>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {importValidation.rows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td className="font-mono text-xs">{row.macAddress || '-'}</td>
                      <td>{row.warehouseCode}</td>
                      <td>
                        {row.issues.length === 0 ? (
                          <span className="badge badge-success badge-sm">OK</span>
                        ) : (
                          row.issues.map((issue) => (
                            <span key={`${row.rowNumber}-${issue.code}`} className="badge badge-warning badge-sm mr-1">
                              {issue.code}
                            </span>
                          ))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body space-y-4 p-5">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {t('adminStock.extensions.title')}
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('adminStock.extensions.description')}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn btn-sm ${extensionProvisionMode === 'manual' ? 'btn-info text-[var(--app-bg)]' : 'btn-outline'}`}
              onClick={() => handleExtensionProvisionModeChange('manual')}
            >
              {t('adminStock.mode.manual')}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${extensionProvisionMode === 'csv' ? 'btn-info text-[var(--app-bg)]' : 'btn-outline'}`}
              onClick={() => handleExtensionProvisionModeChange('csv')}
            >
              {t('adminStock.mode.csv')}
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">Systeme extension</span>
              <select
                className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                value={extensionSystemId}
                onChange={(event) => handleExtensionSystemChange(event.target.value)}
              >
                <option value="">Selectionner</option>
                {extensionCapableSystems.map((system) => (
                  <option key={system.id} value={system.id}>
                    {system.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">Entrepot</span>
              <input
                className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                value={extensionWarehouseCode}
                onChange={(event) => setExtensionWarehouseCode(event.target.value.toUpperCase())}
                placeholder="MAIN"
              />
            </label>
            <div className="text-xs text-[var(--text-secondary)]">
              {selectedExtensionSystem
                ? `Type attendu: ${selectedExtensionIdentifierLabel} (${selectedExtensionSystem.identifierType ?? 'N/A'})`
                : 'Selectionnez un systeme qui supporte les extensions.'}
            </div>
          </div>

          {extensionProvisionMode === 'manual' ? (
            <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
              {selectedExtensionSystem ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="input input-bordered grow bg-[var(--card-bg)] font-mono"
                      placeholder={`Identifiant ${selectedExtensionIdentifierLabel}`}
                      value={manualExtensionInput}
                      onChange={(event) =>
                        setManualExtensionInput(normalizePhysicalIdentifierInput(event.target.value))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleAddManualExtension();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-info"
                      onClick={handleAddManualExtension}
                      disabled={!manualExtensionInput.trim()}
                    >
                      OK
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {manualExtensionBatch.length === 0 ? (
                      <p className="text-xs text-[var(--text-secondary)]">
                        Saisissez un identifiant puis cliquez sur OK.
                      </p>
                    ) : (
                      manualExtensionBatch.map((identifier) => (
                        <button
                          key={identifier}
                          type="button"
                          className="badge badge-outline gap-2 px-2 py-3"
                          onClick={() => handleRemoveManualExtension(identifier)}
                          title="Retirer cette extension"
                        >
                          {identifier}
                          <span aria-hidden="true">x</span>
                        </button>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Format accepte: MAC (AA:BB:CC:DD:EE:FF) ou code alphanumerique (A-Z, 0-9, -, _, :).
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">
                  Selectionnez un systeme pour afficher la saisie des extensions.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs text-[var(--text-secondary)]">
                Format attendu: un identifiant par ligne (ou 1ere colonne CSV).
              </p>
              <input
                type="file"
                accept=".csv,.txt,.xlsx"
                className="file-input file-input-bordered file-input-sm w-full max-w-sm bg-[var(--card-bg)]"
                onChange={handleExtensionImportFile}
              />
              <textarea
                className="textarea textarea-bordered min-h-32 bg-[var(--card-bg)] font-mono text-xs"
                placeholder={'AA:70:31:00:10:01\nAA:70:31:00:10:02\nAA:70:31:00:10:03'}
                value={extensionRawInput}
                onChange={(event) => setExtensionRawInput(event.target.value)}
              />
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Extensions detectees</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">
                {extensionDraftIdentifiers.length}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Doublons</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">
                {duplicateExtensionIdentifiers.length}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Pret a confirmer</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">
                {readyExtensionCount}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-info text-[var(--app-bg)]"
              disabled={
                createExtensionsMutation.isPending ||
                !selectedExtensionSystem ||
                extensionDraftIdentifiers.length === 0 ||
                duplicateExtensionIdentifiers.length > 0 ||
                invalidExtensionIdentifiers.length > 0
              }
              onClick={handleConfirmExtensions}
            >
              {createExtensionsMutation.isPending
                ? t('adminStock.actions.confirmingExtensions')
                : t('adminStock.actions.confirmExtensions')}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={resetExtensionDraft}
            >
              {t('adminStock.actions.clearExtensionsBatch')}
            </button>
          </div>

          {duplicateExtensionIdentifiers.length > 0 ? (
            <div className="rounded-lg border border-[var(--warning-main)]/40 bg-[var(--warning-main)]/10 p-3 text-sm text-[var(--text-primary)]">
              Doublons detectes: {duplicateExtensionIdentifiers.slice(0, 6).join(', ')}
              {duplicateExtensionIdentifiers.length > 6
                ? ` (+${duplicateExtensionIdentifiers.length - 6} autres)`
                : ''}
            </div>
          ) : null}

          {invalidExtensionIdentifiers.length > 0 ? (
            <div className="rounded-lg border border-[var(--error-main)]/40 bg-[var(--error-main)]/10 p-3 text-sm text-[var(--text-primary)]">
              Identifiants invalides: {invalidExtensionIdentifiers.slice(0, 6).join(', ')}
              {invalidExtensionIdentifiers.length > 6
                ? ` (+${invalidExtensionIdentifiers.length - 6} autres)`
                : ''}
            </div>
          ) : null}

          {extensionDraftIdentifiers.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ID extension</th>
                  </tr>
                </thead>
                <tbody>
                  {extensionDraftIdentifiers.slice(0, 80).map((identifier, index) => (
                    <tr key={`${identifier}-${index}`}>
                      <td>{index + 1}</td>
                      <td className="font-mono text-xs">{identifier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {extensionDraftIdentifiers.length > 80 ? (
                <p className="px-3 pb-3 text-xs text-[var(--text-secondary)]">
                  Apercu limite a 80 lignes.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-6">
        {isAdmin ? (
          <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
            <div className="card-body space-y-3 p-5">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {t('adminStock.newSystem.title')}
              </h3>
              <input
                className="input input-bordered bg-[var(--surface-muted)]"
                value={createSystemPayload.name}
                onChange={(event) => setCreateSystemPayload((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nom"
              />
              <select
                className="select select-bordered bg-[var(--surface-muted)]"
                value={createSystemPayload.code}
                onChange={(event) =>
                  setCreateSystemPayload((prev) => {
                    const nextCode = event.target.value as HardwareSystemCode;
                    const isFeedbackSystem = nextCode === 'FEEDBACK';
                    const defaultPricing = DEFAULT_SYSTEM_PRICING[nextCode];
                    const forcedIdentifierType = isFeedbackSystem
                      ? prev.identifierType
                      : SYSTEM_IDENTIFIER_TYPE_MAP[nextCode as Exclude<HardwareSystemCode, 'FEEDBACK'>];
                    return {
                      ...prev,
                      code: nextCode,
                      hasIdentifiers: !isFeedbackSystem,
                      identifierType: forcedIdentifierType,
                      deviceUnitPriceCents: defaultPricing.deviceUnitPriceCents,
                      extensionUnitPriceCents: defaultPricing.extensionUnitPriceCents,
                      currency: defaultPricing.currency,
                    };
                  })
                }
              >
                {SYSTEM_CODE_OPTIONS.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <select
                className="select select-bordered bg-[var(--surface-muted)]"
                value={createSystemPayload.identifierType}
                onChange={() => undefined}
                disabled
              >
                {expectedCreateIdentifierType ? (
                  <option value={expectedCreateIdentifierType}>
                    {expectedCreateIdentifierType} ({getIdentifierTypeLabel(expectedCreateIdentifierType)})
                  </option>
                ) : (
                  <option value={createSystemPayload.identifierType}>Aucun</option>
                )}
              </select>
              <p className="text-xs text-[var(--text-secondary)]">
                Mapping impose: RFID Presence = BADGE, RFID Porte = SERRURE, Biometrie = EMPREINTE.
              </p>
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type="checkbox"
                  className="toggle toggle-info"
                  checked={createSystemPayload.code !== 'FEEDBACK'}
                  onChange={() => undefined}
                  disabled
                />
                <span className="label-text">
                  {createSystemPayload.code === 'FEEDBACK'
                    ? 'Sans identifiants (impose pour FEEDBACK)'
                    : 'Avec identifiants (impose par le type de systeme)'}
                </span>
              </label>
              <div className="grid gap-2 md:grid-cols-3">
                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">Prix boitier</span>
                  <input
                    type="number"
                    min={0}
                    className="input input-bordered bg-[var(--surface-muted)]"
                    value={createSystemPayload.deviceUnitPriceCents}
                    onChange={(event) =>
                      setCreateSystemPayload((prev) => ({
                        ...prev,
                        deviceUnitPriceCents: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">
                    Prix extension
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="input input-bordered bg-[var(--surface-muted)]"
                    value={
                      createSystemPayload.code === 'FEEDBACK'
                        ? 0
                        : createSystemPayload.extensionUnitPriceCents
                    }
                    disabled={createSystemPayload.code === 'FEEDBACK'}
                    onChange={(event) =>
                      setCreateSystemPayload((prev) => ({
                        ...prev,
                        extensionUnitPriceCents: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">Devise</span>
                  <input
                    className="input input-bordered bg-[var(--surface-muted)]"
                    value={createSystemPayload.currency}
                    maxLength={3}
                    onChange={(event) =>
                      setCreateSystemPayload((prev) => ({
                        ...prev,
                        currency: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="XOF"
                  />
                </label>
              </div>
              <button type="button" className="btn btn-info text-[var(--app-bg)]" onClick={handleCreateSystem}>
                {t('adminStock.actions.createSystem')}
              </button>
            </div>
          </article>
        ) : null}
      </section>

      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body space-y-4 p-5">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('adminStock.pricing.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('adminStock.pricing.description')}
          </p>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Systeme</th>
                  <th>Prix boitier</th>
                  <th>Prix extension</th>
                  <th>Devise</th>
                  <th>Apercu</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {systems.map((system) => {
                  const draft = pricingDraftsBySystemId[system.id] ?? {
                    deviceUnitPriceCents: String(system.deviceUnitPriceCents),
                    extensionUnitPriceCents: String(system.extensionUnitPriceCents),
                    currency: system.currency,
                  };
                  const previewDeviceCents = Number.parseInt(draft.deviceUnitPriceCents, 10);
                  const previewExtensionCents = Number.parseInt(draft.extensionUnitPriceCents, 10);
                  const previewCurrency = draft.currency.trim().toUpperCase() || 'XOF';
                  const isPricingPending =
                    updateSystemPricingMutation.isPending && pendingPricingSystemId === system.id;

                  return (
                    <tr key={`pricing-${system.id}`}>
                      <td>
                        <p className="font-medium text-[var(--text-primary)]">{system.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{system.code}</p>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className="input input-bordered input-sm w-36 bg-[var(--surface-muted)]"
                          value={draft.deviceUnitPriceCents}
                          onChange={(event) =>
                            handlePricingDraftChange(
                              system.id,
                              'deviceUnitPriceCents',
                              event.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className="input input-bordered input-sm w-36 bg-[var(--surface-muted)]"
                          value={system.code === 'FEEDBACK' ? '0' : draft.extensionUnitPriceCents}
                          disabled={system.code === 'FEEDBACK'}
                          onChange={(event) =>
                            handlePricingDraftChange(
                              system.id,
                              'extensionUnitPriceCents',
                              event.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input input-bordered input-sm w-20 bg-[var(--surface-muted)]"
                          value={draft.currency}
                          maxLength={3}
                          onChange={(event) =>
                            handlePricingDraftChange(system.id, 'currency', event.target.value)
                          }
                        />
                      </td>
                      <td className="text-xs text-[var(--text-secondary)]">
                        {formatMoneyFromCents(
                          Number.isFinite(previewDeviceCents) ? previewDeviceCents : 0,
                          previewCurrency,
                        )}
                        {system.code !== 'FEEDBACK'
                          ? ` / ${formatMoneyFromCents(
                              Number.isFinite(previewExtensionCents) ? previewExtensionCents : 0,
                              previewCurrency,
                            )}`
                          : ''}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline btn-info btn-sm"
                          disabled={isPricingPending}
                          onClick={() => handleSaveSystemPricing(system.id)}
                        >
                          {isPricingPending ? t('adminStock.actions.saving') : t('adminStock.actions.save')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body space-y-3 p-5">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('adminStock.inventory.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('adminStock.inventory.description')}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <select
              className="select select-bordered bg-[var(--surface-muted)]"
              value={inventoryFilters.systemId ?? ''}
              onChange={(event) =>
                setInventoryFilters((prev) => ({
                  ...prev,
                  page: 1,
                  systemId: event.target.value || undefined,
                }))
              }
            >
              <option value="">Tous systemes</option>
              {systems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </select>
            <select
              className="select select-bordered bg-[var(--surface-muted)]"
              value={inventoryFilters.status ?? ''}
              onChange={(event) =>
                setInventoryFilters((prev) => ({
                  ...prev,
                  page: 1,
                  status: (event.target.value || undefined) as AdminDeviceInventoryQuery['status'],
                }))
              }
            >
              <option value="">Tous statuts</option>
              <option value="IN_STOCK">IN_STOCK</option>
              <option value="RESERVED">RESERVED</option>
              <option value="ASSIGNED">ASSIGNED</option>
            </select>
            <div className="relative grow">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-secondary)]" />
              <input
                className="input input-bordered w-full bg-[var(--surface-muted)] pl-9"
                value={inventoryFilters.search ?? ''}
                onChange={(event) =>
                  setInventoryFilters((prev) => ({
                    ...prev,
                    page: 1,
                    search: event.target.value,
                  }))
                }
                placeholder="Recherche MAC / identifiant"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>MAC</th>
                  <th>Systeme</th>
                  <th>Statut</th>
                  <th>Entrepot</th>
                  <th>Proprietaire</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {inventoryQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center text-sm text-[var(--text-secondary)]">
                      {t('adminStock.inventory.loading')}
                    </td>
                  </tr>
                ) : inventoryQuery.isError ? (
                  <tr>
                    <td colSpan={6} className="text-center text-sm text-[var(--error-main)]">
                      {t('adminStock.inventory.error')}
                    </td>
                  </tr>
                ) : (inventoryQuery.data?.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-sm text-[var(--text-secondary)]">
                      {t('adminStock.inventory.empty')}
                    </td>
                  </tr>
                ) : (
                  inventoryQuery.data?.items.map((device) => (
                    <tr key={device.id}>
                      <td className="font-mono text-xs">{device.macAddress}</td>
                      <td>{device.system.name}</td>
                      <td>
                        <span className="badge badge-outline">{device.status}</span>
                      </td>
                      <td>{device.warehouseCode}</td>
                      <td>{device.ownerEmail ?? '-'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => setSelectedDeviceId(device.id)}
                        >
                          {t('adminStock.inventory.detail')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-[var(--text-secondary)]">
              {(inventoryQuery.data?.total ?? 0).toLocaleString()} boitier(s) au total
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-outline btn-xs"
                disabled={(inventoryFilters.page ?? 1) <= 1}
                onClick={() =>
                  setInventoryFilters((prev) => ({
                    ...prev,
                    page: Math.max(1, (prev.page ?? 1) - 1),
                  }))
                }
              >
                {t('adminStock.pagination.previous')}
              </button>
              <span className="text-[var(--text-secondary)]">
                Page {inventoryFilters.page ?? 1} / {totalInventoryPages}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                disabled={(inventoryFilters.page ?? 1) >= totalInventoryPages}
                onClick={() =>
                  setInventoryFilters((prev) => ({
                    ...prev,
                    page: Math.min(totalInventoryPages, (prev.page ?? 1) + 1),
                  }))
                }
              >
                {t('adminStock.pagination.next')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body p-5">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('adminStock.logs.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('adminStock.logs.description')}
          </p>
          <div className="mt-3 space-y-2 text-sm">
            {adminLogsQuery.isLoading ? (
              <p className="text-sm text-[var(--text-secondary)]">{t('adminStock.logs.loading')}</p>
            ) : adminLogsQuery.isError ? (
              <p className="text-sm text-[var(--error-main)]">{t('adminStock.logs.error')}</p>
            ) : (adminLogsQuery.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">{t('adminStock.logs.empty')}</p>
            ) : (
              (adminLogsQuery.data?.items ?? []).map((log) => (
                <div key={log.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-[var(--text-primary)]">{log.action}</p>
                    <span className="badge badge-outline badge-xs">{log.targetType || 'UNKNOWN'}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {log.actor?.email ?? 'acteur inconnu'} - {formatDateTime(log.createdAt)}
                  </p>
                  {log.targetId ? (
                    <p className="text-xs text-[var(--text-secondary)]">Ressource: {log.targetId}</p>
                  ) : null}
                  {formatAuditDetails(log.details) ? (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                      Details: {formatAuditDetails(log.details)}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body space-y-4 p-5">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('adminStock.webhooks.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('adminStock.webhooks.description')}
          </p>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Endpoints total</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">{webhooks.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Actifs</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">{activeWebhooks}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">En echec</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">{failingWebhooks}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <input
              className="input input-bordered bg-[var(--surface-muted)]"
              placeholder="Nom webhook"
              value={webhookForm.name}
              onChange={(event) => setWebhookForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <input
              className="input input-bordered bg-[var(--surface-muted)]"
              placeholder="https://votre-endpoint/webhook"
              value={webhookForm.url}
              onChange={(event) => setWebhookForm((prev) => ({ ...prev, url: event.target.value }))}
            />
            <select
              className="select select-bordered bg-[var(--surface-muted)]"
              value={webhookForm.eventType}
              onChange={(event) =>
                setWebhookForm((prev) => ({
                  ...prev,
                  eventType: event.target.value as OutboxEventType,
                }))
              }
            >
              {WEBHOOK_EVENT_OPTIONS.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {eventType}
                </option>
              ))}
            </select>
            <input
              className="input input-bordered bg-[var(--surface-muted)]"
              placeholder="Secret (optionnel)"
              value={webhookForm.secret}
              onChange={(event) => setWebhookForm((prev) => ({ ...prev, secret: event.target.value }))}
            />
          </div>

          <button
            type="button"
            className="btn btn-outline btn-info w-fit"
            disabled={createWebhookMutation.isPending || !canCreateWebhook}
            onClick={handleCreateWebhook}
          >
            {createWebhookMutation.isPending
              ? t('adminStock.webhooks.actions.creating')
              : t('adminStock.webhooks.actions.add')}
          </button>
          {pendingWebhookAction ? (
            <p className="text-xs text-[var(--text-secondary)]">
              {t('adminStock.webhooks.pendingAction')}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>URL</th>
                  <th>Events</th>
                  <th>Etat</th>
                  <th>Dernier envoi</th>
                  <th>Echecs</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {webhooksQuery.isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center text-sm text-[var(--text-secondary)]">
                      {t('adminStock.webhooks.loading')}
                    </td>
                  </tr>
                ) : webhooksQuery.isError ? (
                  <tr>
                    <td colSpan={7} className="text-center text-sm text-[var(--error-main)]">
                      {t('adminStock.webhooks.error')}
                    </td>
                  </tr>
                ) : webhooks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-sm text-[var(--text-secondary)]">
                      {t('adminStock.webhooks.empty')}
                    </td>
                  </tr>
                ) : (
                  webhooks.map((webhook) => {
                    const isTogglePending =
                      toggleWebhookMutation.isPending &&
                      pendingWebhookAction?.type === 'toggle' &&
                      pendingWebhookAction.webhookId === webhook.id;
                    const isTestPending =
                      testWebhookMutation.isPending &&
                      pendingWebhookAction?.type === 'test' &&
                      pendingWebhookAction.webhookId === webhook.id;

                    return (
                      <tr key={webhook.id}>
                        <td>{webhook.name}</td>
                        <td className="max-w-[260px] truncate">{webhook.url}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {webhook.events.map((eventType) => (
                              <span key={`${webhook.id}-${eventType}`} className="badge badge-outline badge-xs">
                                {eventType}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${webhook.isActive ? 'badge-success' : 'badge-warning'}`}>
                            {webhook.isActive
                              ? t('adminStock.webhooks.status.active')
                              : t('adminStock.webhooks.status.inactive')}
                          </span>
                        </td>
                        <td>{webhook.lastDeliveredAt ? formatDateTime(webhook.lastDeliveredAt) : 'Jamais'}</td>
                        <td>{webhook.failureCount}</td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              disabled={isTogglePending || isTestPending}
                              onClick={() =>
                                toggleWebhookMutation.mutate({
                                  webhookId: webhook.id,
                                  isActive: !webhook.isActive,
                                })
                              }
                            >
                              {isTogglePending
                                ? t('adminStock.webhooks.actions.toggleUpdating')
                                : webhook.isActive
                                  ? t('adminStock.webhooks.actions.disable')
                                  : t('adminStock.webhooks.actions.enable')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-info btn-xs"
                              disabled={isTogglePending || isTestPending || webhook.events.length === 0}
                              onClick={() =>
                                testWebhookMutation.mutate({
                                  webhookId: webhook.id,
                                  eventType: webhook.events[0],
                                })
                              }
                            >
                              {isTestPending
                                ? t('adminStock.webhooks.actions.testing')
                                : t('adminStock.webhooks.actions.test')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {systems.map((system) => (
          <article key={system.id} className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
            <div className="card-body p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">{system.code}</p>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{system.name}</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {system.code === 'FEEDBACK'
                  ? `Stock: ${system.availableDevices} boitiers (sans extensions)`
                  : `Stock: ${system.availableDevices} boitiers, ${system.availableExtensions} extensions`}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Prix: {formatMoneyFromCents(system.deviceUnitPriceCents, system.currency)}
                {system.code !== 'FEEDBACK'
                  ? ` / ${formatMoneyFromCents(system.extensionUnitPriceCents, system.currency)}`
                  : ''}
              </p>
              <button
                type="button"
                className="btn btn-outline btn-sm mt-2"
                onClick={() =>
                  toggleSystemMutation.mutate({
                    systemId: system.id,
                    isActive: !system.isActive,
                  })
                }
              >
                {system.isActive ? 'Desactiver' : 'Activer'}
              </button>
            </div>
          </article>
        ))}
      </section>

      {selectedDeviceId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card max-h-[80vh] w-full max-w-3xl overflow-y-auto border border-[var(--border-soft)] bg-[var(--card-bg)]">
            <div className="card-body space-y-3 p-5">
              <div className="flex justify-end">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedDeviceId(null)}>
                  {t('adminStock.deviceModal.close')}
                </button>
              </div>
              {deviceDetailQuery.isLoading ? (
                <p className="text-sm text-[var(--text-secondary)]">{t('adminStock.deviceModal.loading')}</p>
              ) : deviceDetailQuery.isError ? (
                <div className="space-y-2">
                  <p className="text-sm text-[var(--error-main)]">{t('adminStock.deviceModal.error')}</p>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => deviceDetailQuery.refetch()}>
                    {t('adminStock.deviceModal.retry')}
                  </button>
                </div>
              ) : !selectedDeviceDetail ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('adminStock.deviceModal.empty')}
                </p>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-[var(--text-secondary)]">{selectedDeviceDetail.system.code}</p>
                      <h3 className="text-lg font-semibold text-[var(--text-primary)]">{selectedDeviceDetail.macAddress}</h3>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-outline">{selectedDeviceDetail.status}</span>
                    <span className="badge badge-outline">{selectedDeviceDetail.warehouseCode}</span>
                    <span className={`badge ${selectedDeviceDetail.isConfigured ? 'badge-success' : 'badge-warning'}`}>
                      {selectedDeviceDetail.isConfigured ? 'Configure' : 'Pret a configurer'}
                    </span>
                  </div>

                  <div className="grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-2">
                    <p>Proprietaire: {selectedDeviceDetail.ownerEmail ?? 'Aucun'}</p>
                    <p>Creation: {formatDateTime(selectedDeviceDetail.createdAt)}</p>
                    <p>Nom: {selectedDeviceDetail.configuredName ?? '-'}</p>
                    <p>Emplacement: {selectedDeviceDetail.configuredLocation ?? '-'}</p>
                    <p>Assignation: {selectedDeviceDetail.assignedAt ? formatDateTime(selectedDeviceDetail.assignedAt) : '-'}</p>
                    {selectedDeviceDetail.system.code === 'FEEDBACK' ? (
                      <p>QR Token: {selectedDeviceDetail.qrCodeToken ?? '-'}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Extensions liees</p>
                    {selectedDeviceIdentifiers.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">Aucune extension liee.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedDeviceIdentifiers.map((identifier) => (
                          <span key={identifier.id} className="badge badge-outline">
                            {identifier.physicalIdentifier}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                      Historique mouvements
                    </p>
                    {selectedDeviceMovements.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">Aucun mouvement enregistre.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDeviceMovements.slice(0, 8).map((movement) => (
                          <div key={movement.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2 text-xs">
                            <p className="font-medium text-[var(--text-primary)]">
                              {movement.action} ({movement.resourceType})
                            </p>
                            <p className="text-[var(--text-secondary)]">
                              {movement.fromStatus ?? '-'} {'->'} {movement.toStatus ?? '-'} | {formatDateTime(movement.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Journal admin lie</p>
                    {selectedDeviceLogs.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">Aucune action admin liee.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDeviceLogs.slice(0, 6).map((log) => (
                          <div key={log.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2 text-xs">
                            <p className="font-medium text-[var(--text-primary)]">{log.action}</p>
                            <p className="text-[var(--text-secondary)]">
                              {log.actor?.email ?? 'acteur inconnu'} - {formatDateTime(log.createdAt)}
                            </p>
                            {formatAuditDetails(log.details) ? (
                              <p className="line-clamp-2 text-[var(--text-secondary)]">
                                Details: {formatAuditDetails(log.details)}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {createDevicesMutation.isSuccess ? (
        <div className="alert border-[var(--success-main)]/40 bg-[var(--success-main)]/10 text-[var(--text-primary)]">
          <CheckCircle2 className="h-4 w-4" />
          <span>{t('adminStock.success.allocationReady')}</span>
        </div>
      ) : null}
    </div>
  );
}
