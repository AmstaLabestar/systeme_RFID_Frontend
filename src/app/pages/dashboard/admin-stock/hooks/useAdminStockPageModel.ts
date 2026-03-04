import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth, useI18n } from '@/app/contexts';
import {
  adminService,
  type AdminBulkDeviceItem,
  type AdminDeviceInventoryQuery,
  type DeviceImportValidationResponse,
  type HardwareSystemCode,
  type IdentifierType,
  type OutboxEventType,
} from '@/app/services';
import {
  DEFAULT_SYSTEM_PRICING,
  SYSTEM_IDENTIFIER_TYPE_MAP,
  type ProvisionMode,
  type SystemPricingDraft,
  isValidPhysicalIdentifier,
  normalizeMacInput,
  normalizePhysicalIdentifierInput,
  parseExtensionRows,
  parseRows,
  parseXlsxRows,
} from '../shared';

export function useAdminStockPageModel() {
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

  return {
    t,
    isAdmin,
    canManageStock,
    systemsQuery,
    systems,
    lowStockAlertsQuery,
    inventoryQuery,
    adminLogsQuery,
    webhooksQuery,
    webhooks,
    activeWebhooks,
    failingWebhooks,
    deviceDetailQuery,
    totalInventoryPages,
    importSystemId,
    setImportSystemId,
    importWarehouseCode,
    setImportWarehouseCode,
    provisionMode,
    setProvisionMode,
    manualMacAddress,
    setManualMacAddress,
    manualIdentifierInput,
    setManualIdentifierInput,
    manualIdentifiers,
    setManualIdentifiers,
    manualBatchDevices,
    setManualBatchDevices,
    importRawInput,
    setImportRawInput,
    importValidation,
    setImportValidation,
    extensionSystemId,
    setExtensionSystemId,
    extensionWarehouseCode,
    setExtensionWarehouseCode,
    extensionProvisionMode,
    setExtensionProvisionMode,
    manualExtensionInput,
    setManualExtensionInput,
    manualExtensionBatch,
    setManualExtensionBatch,
    extensionRawInput,
    setExtensionRawInput,
    inventoryFilters,
    setInventoryFilters,
    selectedDeviceId,
    setSelectedDeviceId,
    createSystemPayload,
    setCreateSystemPayload,
    webhookForm,
    setWebhookForm,
    pendingWebhookAction,
    setPendingWebhookAction,
    pricingDraftsBySystemId,
    setPricingDraftsBySystemId,
    pendingPricingSystemId,
    setPendingPricingSystemId,
    selectedImportSystem,
    extensionCapableSystems,
    selectedExtensionSystem,
    expectedCreateIdentifierType,
    requiredIdentifiersPerDevice,
    selectedImportIdentifierLabel,
    selectedExtensionIdentifierLabel,
    parsedCsvRows,
    draftRows,
    parsedExtensionCsvRows,
    extensionDraftIdentifiers,
    duplicateExtensionIdentifiers,
    invalidExtensionIdentifiers,
    readyExtensionCount,
    createSystemMutation,
    toggleSystemMutation,
    updateSystemPricingMutation,
    validateImportMutation,
    createDevicesMutation,
    createExtensionsMutation,
    createWebhookMutation,
    toggleWebhookMutation,
    testWebhookMutation,
    resetProvisionDraft,
    resetExtensionDraft,
    handleImportSystemChange,
    handleProvisionModeChange,
    handleExtensionSystemChange,
    handleExtensionProvisionModeChange,
    handleAddManualIdentifier,
    handleRemoveManualIdentifier,
    handleAddManualDevice,
    handleRemoveManualDevice,
    handleAddManualExtension,
    handleRemoveManualExtension,
    handleExtensionImportFile,
    handleConfirmExtensions,
    handleVerifyImport,
    handleImportFile,
    handleConfirmImport,
    handleCreateSystem,
    handlePricingDraftChange,
    handleSaveSystemPricing,
    handleCreateWebhook,
    importStep,
    importIssuesPreview,
    selectedDeviceDetail,
    selectedDeviceMovements,
    selectedDeviceLogs,
    selectedDeviceIdentifiers,
    canCreateWebhook,
    getIdentifierTypeLabel,
    normalizePhysicalIdentifierInput,
  };
}

export type AdminStockPageModel = ReturnType<typeof useAdminStockPageModel>;
