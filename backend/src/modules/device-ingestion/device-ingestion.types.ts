import type { HardwareSystemCode } from '@prisma/client';
import type { Request } from 'express';

export interface DeviceAuthContext {
  keyId: string;
  ownerId: string;
  ownerTenantId?: string;
  deviceId: string;
  systemCode: HardwareSystemCode;
  macAddress: string;
}

export interface DeviceIngestionRequest extends Request {
  deviceAuth?: DeviceAuthContext;
}
