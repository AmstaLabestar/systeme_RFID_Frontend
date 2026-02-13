import type {
  DeviceUnit,
  Employee,
  FeedbackRecord,
  HistoryEvent,
  InventoryIdentifier,
  ServiceAssignment,
} from '@/app/types';

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
