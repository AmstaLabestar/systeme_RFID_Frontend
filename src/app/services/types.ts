import type {
  DeviceUnit,
  Employee,
  FeedbackRecord,
  HistoryEvent,
  InventoryIdentifier,
  PresenceSnapshotDevice,
  PresenceSnapshotEvent,
  PresenceSnapshotTotals,
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

export interface PresenceSnapshotPayload {
  lookbackHours: number;
  periodStartAt: string;
  periodEndAt: string;
  totals: PresenceSnapshotTotals;
  byDevice: PresenceSnapshotDevice[];
  lastScans: PresenceSnapshotEvent[];
}

export interface SystemsStatePayload {
  marketplace: MarketplaceStatePayload;
  services: ServicesStatePayload;
}
