import type {
  Device,
  BusinessSystem,
  Identifier,
  ServiceAssignment,
} from '@prisma/client';

export interface CursorPageInfoDto {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

type IdentifierWithAssignment = Identifier & {
  serviceAssignment: Pick<ServiceAssignment, 'employeeId' | 'deviceId'> | null;
};

type DeviceWithRelations = Device & {
  system: BusinessSystem;
  identifiers: IdentifierWithAssignment[];
};

type StandaloneIdentifierWithRelations = Identifier & {
  system: BusinessSystem;
  serviceAssignment: Pick<ServiceAssignment, 'employeeId' | 'deviceId'> | null;
};

export interface GetMyDevicesResponseDto {
  devices: DeviceWithRelations[];
  standaloneIdentifiers: StandaloneIdentifierWithRelations[];
  pagination: {
    devices: CursorPageInfoDto;
    standaloneIdentifiers: CursorPageInfoDto;
  };
}
