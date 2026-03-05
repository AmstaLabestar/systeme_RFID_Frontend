export type ModuleKey = 'rfid-presence' | 'rfid-porte' | 'biometrie' | 'feedback';

export type DashboardPage =
  | 'overview'
  | 'marketplace'
  | 'admin-stock'
  | 'rfid-presence'
  | 'rfid-porte'
  | 'biometrie'
  | 'feedback'
  | 'historique';

export type IdentifierType = 'badge-rfid' | 'empreinte' | 'serrure-rfid';

export type ProductKind = 'device' | 'identifier-pack';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  roleName?: string;
}

export interface Product {
  id: string;
  apiSku?: string;
  kind: ProductKind;
  module: ModuleKey;
  identifierType?: IdentifierType;
  label: string;
  description: string;
  unitPriceMinor: number;
  currency: string;
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
  status: 'available' | 'assigned' | 'disabled';
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
  eventType?: 'assigned' | 'removed' | 'reassigned' | 'identifier_disabled';
  action: string;
  actorId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}

export type FeedbackSentiment = 'negative' | 'neutral' | 'positive';
export type FeedbackSource = 'BUTTON' | 'QR';

export interface FeedbackRecord {
  id: string;
  deviceId: string;
  module: 'feedback';
  sentiment: FeedbackSentiment;
  source?: FeedbackSource;
  comment?: string;
  createdAt: string;
}

export type NotificationKind = 'success' | 'info' | 'warning' | 'error';

export interface NotificationIdentifierSections {
  deviceIdentifiers: string[];
  extensionIdentifiers: string[];
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  kind: NotificationKind;
  module?: ModuleKey;
  identifierSections?: NotificationIdentifierSections;
}

export interface PurchaseResult {
  purchaseId: string;
  createdDevices: DeviceUnit[];
  createdIdentifiers: InventoryIdentifier[];
  redirectModule: ModuleKey;
}

export interface DashboardNavItem {
  page: DashboardPage;
  label: string;
  path: string;
  module?: ModuleKey;
  roles?: string[];
}

export interface DeviceConfigurationInput {
  name?: string;
  location: string;
  systemIdentifier: string;
}

export interface AssignIdentifierInput {
  module: ModuleKey;
  deviceId: string;
  identifierId: string;
  firstName: string;
  lastName: string;
}

export interface ReassignIdentifierInput {
  assignmentId: string;
  deviceId: string;
  firstName: string;
  lastName: string;
  reason?: string;
}
