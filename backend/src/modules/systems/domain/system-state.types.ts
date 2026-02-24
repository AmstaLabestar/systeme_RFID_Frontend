export type ModuleKey = 'rfid-presence' | 'rfid-porte' | 'biometrie' | 'feedback';
export type IdentifierType = 'badge-rfid' | 'empreinte' | 'serrure-rfid';
export type InventoryStatus = 'available' | 'assigned';
export type FeedbackSentiment = 'negative' | 'neutral' | 'positive';
export type FeedbackSource = 'BUTTON' | 'QR';

export interface MarketplaceProduct {
  id: string;
  apiSku?: string;
  kind: 'device' | 'identifier-pack';
  module: ModuleKey;
  identifierType?: IdentifierType;
  label: string;
  description: string;
  unitPrice: number;
  stockLimit?: number;
  includedIdentifiers?: number;
  quantityPerPack?: number;
}

export interface DeviceUnit {
  id: string;
  module: ModuleKey;
  name: string;
  location: string;
  provisionedMacAddress: string;
  qrToken?: string;
  systemIdentifier?: string;
  configured: boolean;
  capacity: number;
  createdAt: string;
  activatedAt?: string;
}

export interface InventoryIdentifier {
  id: string;
  module: ModuleKey;
  type: IdentifierType;
  code: string;
  status: InventoryStatus;
  deviceId?: string;
  employeeId?: string;
  acquiredAt: string;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

export interface ServiceAssignment {
  id: string;
  module: ModuleKey;
  deviceId: string;
  identifierId: string;
  employeeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEvent {
  id: string;
  module: ModuleKey;
  deviceId: string;
  employee: string;
  identifier: string;
  device: string;
  action: string;
  occurredAt: string;
}

export interface FeedbackRecord {
  id: string;
  deviceId: string;
  module: 'feedback';
  sentiment: FeedbackSentiment;
  source: FeedbackSource;
  comment?: string;
  createdAt: string;
}

export interface MarketplaceStatePayload {
  productStockById: Record<string, number | null>;
  devices: DeviceUnit[];
  inventory: InventoryIdentifier[];
}

export interface ServicesStatePayload {
  employees: Employee[];
  assignments: ServiceAssignment[];
  history: HistoryEvent[];
  feedbackRecords: FeedbackRecord[];
}

export interface SystemsStatePayload {
  marketplace: MarketplaceStatePayload;
  services: ServicesStatePayload;
}

export interface ServiceMutationMeta {
  module: ModuleKey;
  action: 'assign' | 'remove' | 'reassign';
  employeeName: string;
  identifierCode: string;
  deviceName: string;
}
