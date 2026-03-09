export interface PresenceSnapshotDeviceDto {
  deviceId: string;
  deviceName: string;
  totalScans: number;
  attributedScans: number;
  unattributedScans: number;
  lastScanAt: string | null;
}

export interface PresenceSnapshotEventDto {
  id: string;
  deviceId: string;
  deviceName: string;
  employee: string;
  identifier: string;
  occurredAt: string;
  attributed: boolean;
}

export interface GetPresenceSnapshotResponseDto {
  lookbackHours: number;
  periodStartAt: string;
  periodEndAt: string;
  totals: {
    totalScans: number;
    attributedScans: number;
    unattributedScans: number;
    activeEmployees: number;
  };
  byDevice: PresenceSnapshotDeviceDto[];
  lastScans: PresenceSnapshotEventDto[];
}
