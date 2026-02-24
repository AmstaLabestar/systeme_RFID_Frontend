import { ADMIN_ROUTES } from './contracts';
import { systemApiClient, toApiErrorMessage } from './httpClient';

export type HardwareSystemCode = 'RFID_PRESENCE' | 'RFID_PORTE' | 'BIOMETRIE' | 'FEEDBACK';
export type IdentifierType = 'BADGE' | 'EMPREINTE' | 'SERRURE';

export interface AdminSystemStock {
  id: string;
  name: string;
  code: HardwareSystemCode;
  hasIdentifiers: boolean;
  identifiersPerDevice: number;
  identifierType: IdentifierType | null;
  isActive: boolean;
  availableDevices: number;
  availableExtensions: number;
}

export interface AdminBulkDeviceItem {
  macAddress: string;
  identifiers?: string[];
}

export interface AdminBulkDevicesPayload {
  quantity: number;
  devices: AdminBulkDeviceItem[];
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
    isActive: asBoolean(source.isActive, false),
    availableDevices: asNumber(source.availableDevices, 0),
    availableExtensions: asNumber(source.availableExtensions, 0),
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
    payload: { type?: IdentifierType; physicalIdentifiers: string[] },
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
};
