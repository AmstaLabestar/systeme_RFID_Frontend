import { ADMIN_ROUTES } from './contracts';
import { systemApiClient, toApiErrorMessage } from './httpClient';

export type HardwareSystemCode = 'RFID_PRESENCE' | 'RFID_PORTE' | 'BIOMETRIE' | 'FEEDBACK';
export type IdentifierType = 'BADGE' | 'EMPREINTE' | 'SERRURE';
export type DeviceStatus = 'IN_STOCK' | 'RESERVED' | 'ASSIGNED';
export type StockResourceType = 'DEVICE' | 'IDENTIFIER';
export type StockMovementAction =
  | 'STOCK_CREATED'
  | 'EXTENSION_STOCK_CREATED'
  | 'RESERVED'
  | 'ASSIGNED'
  | 'RELEASED'
  | 'CONFIGURED';
export type OutboxEventType =
  | 'ORDER_ALLOCATED'
  | 'STOCK_LOW'
  | 'DEVICE_ACTIVATED'
  | 'RESERVATION_RELEASED';

export interface AdminSystemStock {
  id: string;
  name: string;
  code: HardwareSystemCode;
  hasIdentifiers: boolean;
  identifiersPerDevice: number;
  identifierType: IdentifierType | null;
  deviceUnitPriceCents: number;
  extensionUnitPriceCents: number;
  currency: string;
  isActive: boolean;
  lowStockThreshold: number;
  availableDevices: number;
  availableExtensions: number;
  isLowStock: boolean;
}

export interface AdminBulkDeviceItem {
  macAddress: string;
  identifiers?: string[];
  warehouseCode?: string;
}

export interface AdminBulkDevicesPayload {
  quantity: number;
  devices: AdminBulkDeviceItem[];
  warehouseCode?: string;
}

export interface AdminDeviceInventoryQuery {
  page?: number;
  limit?: number;
  systemId?: string;
  systemCode?: HardwareSystemCode;
  status?: DeviceStatus;
  warehouseCode?: string;
  search?: string;
}

export interface AdminInventoryDevice {
  id: string;
  macAddress: string;
  status: DeviceStatus;
  warehouseCode: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  configuredName?: string;
  configuredLocation?: string;
  isConfigured: boolean;
  qrCodeToken?: string;
  createdAt: string;
  assignedAt?: string;
  system: {
    id: string;
    code: HardwareSystemCode;
    name: string;
  };
  identifiers: Array<{
    id: string;
    physicalIdentifier: string;
    status: string;
    ownerId?: string;
  }>;
}

export interface AdminPaginatedResponse<T> {
  total: number;
  page: number;
  limit: number;
  items: T[];
}

export interface DeviceImportValidationIssue {
  field: 'macAddress' | 'identifiers' | 'warehouseCode';
  code: string;
  message: string;
}

export interface DeviceImportValidationRow {
  rowNumber: number;
  macAddress: string;
  warehouseCode: string;
  identifiers: string[];
  issues: DeviceImportValidationIssue[];
}

export interface DeviceImportValidationResponse {
  system: {
    id: string;
    name: string;
    code: HardwareSystemCode;
    hasIdentifiers: boolean;
    identifiersPerDevice: number;
  };
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
  canCommit: boolean;
  rows: DeviceImportValidationRow[];
}

export interface AdminLowStockAlert {
  systemId: string;
  systemCode: HardwareSystemCode;
  systemName: string;
  warehouseCode: string;
  threshold: number;
  availableDevices: number;
  availableExtensions: number;
  recommendedDeviceRestock: number;
  recommendedExtensionRestock: number;
  severity: 'warning' | 'critical';
}

export interface AdminStockMovement {
  id: string;
  resourceType: StockResourceType;
  action: StockMovementAction;
  resourceId: string;
  fromStatus?: string;
  toStatus?: string;
  warehouseCode?: string;
  createdAt: string;
  systemName?: string;
  deviceMacAddress?: string;
  physicalIdentifier?: string;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId?: string;
  createdAt: string;
  actor?: {
    id: string;
    name?: string;
    email?: string;
  };
  details?: unknown;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: OutboxEventType[];
  isActive: boolean;
  failureCount: number;
  lastDeliveredAt?: string;
  createdAt: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return fallback;
}

function toAdminSystem(value: unknown): AdminSystemStock | null {
  const source = asRecord(value);
  const id = asString(source.id);
  const code = asString(source.code) as HardwareSystemCode;
  if (!id || !code) {
    return null;
  }

  return {
    id,
    name: asString(source.name, code),
    code,
    hasIdentifiers: asBoolean(source.hasIdentifiers, false),
    identifiersPerDevice: asNumber(source.identifiersPerDevice, 0),
    identifierType: (asString(source.identifierType, '') as IdentifierType) || null,
    deviceUnitPriceCents: asNumber(source.deviceUnitPriceCents, 0),
    extensionUnitPriceCents: asNumber(source.extensionUnitPriceCents, 0),
    currency: asString(source.currency, 'XOF'),
    isActive: asBoolean(source.isActive, false),
    lowStockThreshold: asNumber(source.lowStockThreshold, 5),
    availableDevices: asNumber(source.availableDevices, 0),
    availableExtensions: asNumber(source.availableExtensions, 0),
    isLowStock: asBoolean(source.isLowStock, false),
  };
}

function toInventoryDevice(value: unknown): AdminInventoryDevice | null {
  const source = asRecord(value);
  const system = asRecord(source.system);
  const owner = asRecord(source.owner);
  const id = asString(source.id);
  if (!id) {
    return null;
  }

  return {
    id,
    macAddress: asString(source.macAddress),
    status: asString(source.status, 'IN_STOCK') as DeviceStatus,
    warehouseCode: asString(source.warehouseCode, 'MAIN'),
    ownerId: asString(source.ownerId) || undefined,
    ownerName: asString(owner.name) || undefined,
    ownerEmail: asString(owner.email) || undefined,
    configuredName: asString(source.configuredName) || undefined,
    configuredLocation: asString(source.configuredLocation) || undefined,
    isConfigured: asBoolean(source.isConfigured, false),
    qrCodeToken: asString(source.qrCodeToken) || undefined,
    createdAt: asString(source.createdAt, new Date().toISOString()),
    assignedAt: asString(source.assignedAt) || undefined,
    system: {
      id: asString(system.id),
      code: asString(system.code) as HardwareSystemCode,
      name: asString(system.name, 'Systeme'),
    },
    identifiers: asArray(source.identifiers).map((identifierRaw) => {
      const identifier = asRecord(identifierRaw);
      return {
        id: asString(identifier.id),
        physicalIdentifier: asString(identifier.physicalIdentifier),
        status: asString(identifier.status),
        ownerId: asString(identifier.ownerId) || undefined,
      };
    }),
  };
}

function toPaginatedResponse<T>(value: unknown, mapper: (raw: unknown) => T | null): AdminPaginatedResponse<T> {
  const source = asRecord(value);
  return {
    total: asNumber(source.total, 0),
    page: asNumber(source.page, 1),
    limit: asNumber(source.limit, 20),
    items: asArray(source.items)
      .map(mapper)
      .filter((entry): entry is T => entry !== null),
  };
}

export const adminService = {
  async listSystems(): Promise<AdminSystemStock[]> {
    try {
      const response = await systemApiClient.get<unknown>(ADMIN_ROUTES.systems);
      return asArray(response.data)
        .map(toAdminSystem)
        .filter((entry): entry is AdminSystemStock => entry !== null);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Impossible de charger les systemes admin.'));
    }
  },

  async createSystem(payload: {
    name: string;
    code: HardwareSystemCode;
    hasIdentifiers: boolean;
    identifiersPerDevice: number;
    identifierType?: IdentifierType;
    deviceUnitPriceCents?: number;
    extensionUnitPriceCents?: number;
    currency?: string;
    isActive?: boolean;
  }) {
    try {
      const response = await systemApiClient.post<unknown>(ADMIN_ROUTES.createSystem, payload);
      return toAdminSystem(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Creation du systeme impossible.'));
    }
  },

  async updateSystemActivation(systemId: string, isActive: boolean) {
    try {
      const response = await systemApiClient.patch<unknown>(
        ADMIN_ROUTES.updateSystemActivation(systemId),
        { isActive },
      );
      return toAdminSystem(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Mise a jour activation impossible.'));
    }
  },

  async updateSystemPricing(
    systemId: string,
    payload: {
      deviceUnitPriceCents: number;
      extensionUnitPriceCents: number;
      currency?: string;
    },
  ) {
    try {
      const response = await systemApiClient.patch<unknown>(
        ADMIN_ROUTES.updateSystemPricing(systemId),
        payload,
      );
      return toAdminSystem(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Mise a jour tarification impossible.'));
    }
  },

  async validateDevicesImport(
    systemId: string,
    payload: { devices: AdminBulkDeviceItem[]; warehouseCode?: string },
  ): Promise<DeviceImportValidationResponse> {
    try {
      const response = await systemApiClient.post<unknown>(
        ADMIN_ROUTES.validateDevicesImport(systemId),
        payload,
      );
      const source = asRecord(response.data);
      return {
        system: {
          id: asString(asRecord(source.system).id),
          name: asString(asRecord(source.system).name),
          code: asString(asRecord(source.system).code) as HardwareSystemCode,
          hasIdentifiers: asBoolean(asRecord(source.system).hasIdentifiers, false),
          identifiersPerDevice: asNumber(asRecord(source.system).identifiersPerDevice, 0),
        },
        summary: {
          totalRows: asNumber(asRecord(source.summary).totalRows, 0),
          validRows: asNumber(asRecord(source.summary).validRows, 0),
          invalidRows: asNumber(asRecord(source.summary).invalidRows, 0),
        },
        canCommit: asBoolean(source.canCommit, false),
        rows: asArray(source.rows).map((rowRaw) => {
          const row = asRecord(rowRaw);
          return {
            rowNumber: asNumber(row.rowNumber, 0),
            macAddress: asString(row.macAddress),
            warehouseCode: asString(row.warehouseCode, 'MAIN'),
            identifiers: asArray(row.identifiers).map((entry) => asString(entry)),
            issues: asArray(row.issues).map((issueRaw) => {
              const issue = asRecord(issueRaw);
              return {
                field: asString(issue.field) as DeviceImportValidationIssue['field'],
                code: asString(issue.code),
                message: asString(issue.message),
              };
            }),
          };
        }),
      };
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Validation import impossible.'));
    }
  },

  async createDevicesBulk(systemId: string, payload: AdminBulkDevicesPayload) {
    try {
      const response = await systemApiClient.post<unknown>(
        ADMIN_ROUTES.createDevicesBulk(systemId),
        payload,
      );
      return asRecord(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Provisionning boitiers impossible.'));
    }
  },

  async createSystemIdentifiersBulk(
    systemId: string,
    payload: { type?: IdentifierType; physicalIdentifiers: string[]; warehouseCode?: string },
  ) {
    try {
      const response = await systemApiClient.post<unknown>(
        ADMIN_ROUTES.createSystemIdentifiersBulk(systemId),
        payload,
      );
      return asRecord(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Provisionning extensions impossible.'));
    }
  },

  async createDeviceIdentifiers(
    deviceId: string,
    payload: { type?: IdentifierType; physicalIdentifiers: string[] },
  ) {
    try {
      const response = await systemApiClient.post<unknown>(
        ADMIN_ROUTES.createDeviceIdentifiers(deviceId),
        payload,
      );
      return asRecord(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Ajout identifiants sur boitier impossible.'));
    }
  },

  async listInventoryDevices(
    query: AdminDeviceInventoryQuery,
  ): Promise<AdminPaginatedResponse<AdminInventoryDevice>> {
    try {
      const response = await systemApiClient.get<unknown>(ADMIN_ROUTES.inventoryDevices, {
        params: query,
      });
      return toPaginatedResponse(response.data, toInventoryDevice);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Inventaire admin indisponible.'));
    }
  },

  async getInventoryDevice(deviceId: string) {
    try {
      const response = await systemApiClient.get<unknown>(ADMIN_ROUTES.inventoryDeviceById(deviceId));
      const source = asRecord(response.data);
      return {
        device: toInventoryDevice(source.device),
        movements: asArray(source.movements).map((movementRaw) => {
          const movement = asRecord(movementRaw);
          const system = asRecord(movement.system);
          const device = asRecord(movement.device);
          const identifier = asRecord(movement.identifier);
          return {
            id: asString(movement.id),
            resourceType: asString(movement.resourceType) as StockResourceType,
            action: asString(movement.action) as StockMovementAction,
            resourceId: asString(movement.resourceId),
            fromStatus: asString(movement.fromStatus) || undefined,
            toStatus: asString(movement.toStatus) || undefined,
            warehouseCode: asString(movement.warehouseCode) || undefined,
            createdAt: asString(movement.createdAt),
            systemName: asString(system.name) || undefined,
            deviceMacAddress: asString(device.macAddress) || undefined,
            physicalIdentifier: asString(identifier.physicalIdentifier) || undefined,
          } as AdminStockMovement;
        }),
        adminLogs: asArray(source.adminLogs).map((logRaw) => {
          const log = asRecord(logRaw);
          const actor = asRecord(log.actor);
          return {
            id: asString(log.id),
            action: asString(log.action),
            targetType: asString(log.targetType),
            targetId: asString(log.targetId) || undefined,
            createdAt: asString(log.createdAt),
            actor: {
              id: asString(actor.id),
              name: asString(actor.name) || undefined,
              email: asString(actor.email) || undefined,
            },
            details: log.details,
          } as AdminAuditLog;
        }),
      };
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Detail boitier indisponible.'));
    }
  },

  async listLowStockAlerts(): Promise<AdminLowStockAlert[]> {
    try {
      const response = await systemApiClient.get<unknown>(ADMIN_ROUTES.inventoryAlerts);
      return asArray(response.data).map((entryRaw) => {
        const entry = asRecord(entryRaw);
        return {
          systemId: asString(entry.systemId),
          systemCode: asString(entry.systemCode) as HardwareSystemCode,
          systemName: asString(entry.systemName),
          warehouseCode: asString(entry.warehouseCode, 'MAIN'),
          threshold: asNumber(entry.threshold, 0),
          availableDevices: asNumber(entry.availableDevices, 0),
          availableExtensions: asNumber(entry.availableExtensions, 0),
          recommendedDeviceRestock: asNumber(entry.recommendedDeviceRestock, 0),
          recommendedExtensionRestock: asNumber(entry.recommendedExtensionRestock, 0),
          severity: asString(entry.severity, 'warning') as 'warning' | 'critical',
        };
      });
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Alertes stock bas indisponibles.'));
    }
  },

  async listStockMovements(query: {
    page?: number;
    limit?: number;
    systemId?: string;
    resourceType?: StockResourceType;
    action?: StockMovementAction;
    warehouseCode?: string;
    search?: string;
  }): Promise<AdminPaginatedResponse<AdminStockMovement>> {
    try {
      const response = await systemApiClient.get<unknown>(ADMIN_ROUTES.inventoryMovements, {
        params: query,
      });
      return toPaginatedResponse(response.data, (entryRaw) => {
        const entry = asRecord(entryRaw);
        const system = asRecord(entry.system);
        const device = asRecord(entry.device);
        const identifier = asRecord(entry.identifier);
        return {
          id: asString(entry.id),
          resourceType: asString(entry.resourceType) as StockResourceType,
          action: asString(entry.action) as StockMovementAction,
          resourceId: asString(entry.resourceId),
          fromStatus: asString(entry.fromStatus) || undefined,
          toStatus: asString(entry.toStatus) || undefined,
          warehouseCode: asString(entry.warehouseCode) || undefined,
          createdAt: asString(entry.createdAt),
          systemName: asString(system.name) || undefined,
          deviceMacAddress: asString(device.macAddress) || undefined,
          physicalIdentifier: asString(identifier.physicalIdentifier) || undefined,
        };
      });
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Mouvements de stock indisponibles.'));
    }
  },

  async listAdminLogs(query: {
    page?: number;
    limit?: number;
    action?: string;
    targetType?: string;
    actorId?: string;
  }): Promise<AdminPaginatedResponse<AdminAuditLog>> {
    try {
      const response = await systemApiClient.get<unknown>(ADMIN_ROUTES.adminLogs, {
        params: query,
      });
      return toPaginatedResponse(response.data, (entryRaw) => {
        const entry = asRecord(entryRaw);
        const actor = asRecord(entry.actor);
        return {
          id: asString(entry.id),
          action: asString(entry.action),
          targetType: asString(entry.targetType),
          targetId: asString(entry.targetId) || undefined,
          createdAt: asString(entry.createdAt),
          actor: {
            id: asString(actor.id),
            name: asString(actor.name) || undefined,
            email: asString(actor.email) || undefined,
          },
          details: entry.details,
        };
      });
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Journal admin indisponible.'));
    }
  },

  async listWebhooks(): Promise<WebhookEndpoint[]> {
    try {
      const response = await systemApiClient.get<unknown>(ADMIN_ROUTES.webhooks);
      return asArray(response.data).map((entryRaw) => {
        const entry = asRecord(entryRaw);
        return {
          id: asString(entry.id),
          name: asString(entry.name),
          url: asString(entry.url),
          events: asArray(entry.events).map((eventType) => asString(eventType) as OutboxEventType),
          isActive: asBoolean(entry.isActive, false),
          failureCount: asNumber(entry.failureCount, 0),
          lastDeliveredAt: asString(entry.lastDeliveredAt) || undefined,
          createdAt: asString(entry.createdAt),
        };
      });
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Webhooks admin indisponibles.'));
    }
  },

  async createWebhook(payload: {
    name: string;
    url: string;
    events: OutboxEventType[];
    secret?: string;
  }) {
    try {
      const response = await systemApiClient.post<unknown>(ADMIN_ROUTES.webhooks, payload);
      return asRecord(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Creation webhook impossible.'));
    }
  },

  async updateWebhookActivation(webhookId: string, isActive: boolean) {
    try {
      const response = await systemApiClient.patch<unknown>(
        ADMIN_ROUTES.updateWebhookActivation(webhookId),
        { isActive },
      );
      return asRecord(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Mise a jour webhook impossible.'));
    }
  },

  async testWebhook(webhookId: string, eventType?: OutboxEventType) {
    try {
      const response = await systemApiClient.post<unknown>(
        ADMIN_ROUTES.testWebhook(webhookId),
        {
          eventType,
        },
      );
      return asRecord(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Test webhook impossible.'));
    }
  },
};
