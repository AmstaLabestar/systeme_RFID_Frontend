import {
  DeviceStatus,
  HardwareSystemCode,
  IdentifierType,
  type BusinessSystem,
} from '@prisma/client';

export interface DeviceSeedInput {
  macAddress: string;
  identifiers?: string[];
  warehouseCode?: string;
}

export interface CreateDevicesInBulkInput {
  systemId: string;
  quantity: number;
  devices: DeviceSeedInput[];
  createdById: string;
  warehouseCode?: string;
}

export interface AddIdentifiersToDeviceInput {
  deviceId: string;
  physicalIdentifiers: string[];
  type?: IdentifierType;
  createdById: string;
}

export interface AddIdentifiersToSystemInput {
  systemId: string;
  physicalIdentifiers: string[];
  type?: IdentifierType;
  createdById: string;
  warehouseCode?: string;
}

export interface SystemStockOverview {
  id: string;
  name: string;
  code: BusinessSystem['code'];
  hasIdentifiers: boolean;
  identifiersPerDevice: number;
  identifierType: BusinessSystem['identifierType'];
  deviceUnitPriceCents: number;
  extensionUnitPriceCents: number;
  currency: string;
  isActive: boolean;
  lowStockThreshold: number;
  availableDevices: number;
  availableExtensions: number;
  isLowStock: boolean;
}

export interface ListAdminInventoryInput {
  page: number;
  limit: number;
  systemId?: string;
  systemCode?: HardwareSystemCode;
  status?: DeviceStatus;
  warehouseCode?: string;
  search?: string;
}

export interface WarehouseStockSnapshot {
  systemId: string;
  warehouseCode: string;
  availableDevices: number;
  availableExtensions: number;
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

export interface ValidateDeviceImportBatchInput {
  systemId: string;
  devices: DeviceSeedInput[];
  warehouseCode?: string;
}
