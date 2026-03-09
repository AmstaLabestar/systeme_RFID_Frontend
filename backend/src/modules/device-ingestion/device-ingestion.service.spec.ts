import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DeviceStatus, HardwareSystemCode } from '@prisma/client';
import { DeviceIngestionService } from './device-ingestion.service';
import type { DeviceAuthContext } from './device-ingestion.types';
import type { IngestDeviceEventDto } from './dto/ingest-device-event.dto';

type AnyMock = jest.Mock<any, any>;

interface MetricsMock {
  recordDeviceIngestionAccepted: AnyMock;
  recordDeviceIngestionDuplicate: AnyMock;
  recordDeviceIngestionRejected: AnyMock;
  recordDeviceIngestionAuthFailure: AnyMock;
}

function buildDto(overrides: Partial<IngestDeviceEventDto> = {}): IngestDeviceEventDto {
  return {
    schemaVersion: '1.0',
    eventId: '550e8400-e29b-41d4-a716-446655440000',
    eventType: 'badge.scanned',
    occurredAt: '2026-03-05T12:00:00.000Z',
    sentAt: '2026-03-05T12:00:01.000Z',
    source: {
      deviceId: 'device-1',
      deviceMac: 'AA:BB:CC:DD:EE:FF',
      systemCode: HardwareSystemCode.RFID_PRESENCE,
      sequence: 42,
    },
    payload: {
      badgeCode: 'ABCD1234',
    },
    ...overrides,
  };
}

function buildContext(overrides: Partial<DeviceAuthContext> = {}): DeviceAuthContext {
  return {
    keyId: 'key-1',
    ownerId: 'owner-1',
    ownerTenantId: 'tenant-1',
    deviceId: 'device-1',
    systemCode: HardwareSystemCode.RFID_PRESENCE,
    macAddress: 'AA:BB:CC:DD:EE:FF',
    ...overrides,
  };
}

function createService() {
  const tx = {
    deviceEventInbox: {
      create: jest.fn(),
    },
    deviceEventStore: {
      create: jest.fn(),
    },
    deviceIngestionKey: {
      update: jest.fn(),
    },
  };

  const prisma = {
    device: {
      findFirst: jest.fn(),
    },
    deviceIngestionKey: {
      upsert: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    deviceEventInbox: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const metrics: MetricsMock = {
    recordDeviceIngestionAccepted: jest.fn(),
    recordDeviceIngestionDuplicate: jest.fn(),
    recordDeviceIngestionRejected: jest.fn(),
    recordDeviceIngestionAuthFailure: jest.fn(),
  };

  const service = new DeviceIngestionService(prisma as any, metrics as any);

  return {
    service,
    prisma,
    tx,
    metrics,
  };
}

describe('DeviceIngestionService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('stores event in inbox/store and records accepted metric', async () => {
    const context = buildContext();
    const dto = buildDto();
    const { service, prisma, tx, metrics } = createService();
    const receivedAt = new Date('2026-03-05T12:00:02.000Z');

    tx.deviceEventInbox.create.mockResolvedValue({
      id: 'inbox-1',
      receivedAt,
    });
    tx.deviceEventStore.create.mockResolvedValue({});
    tx.deviceIngestionKey.update.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (callback: AnyMock) => callback(tx));

    const response = await service.ingestEvent(context, dto);

    expect(response.status).toBe('accepted');
    expect(response.inboxId).toBe('inbox-1');
    expect(tx.deviceEventInbox.create).toHaveBeenCalledTimes(1);
    expect(tx.deviceEventStore.create).toHaveBeenCalledTimes(1);
    expect(metrics.recordDeviceIngestionAccepted).toHaveBeenCalledTimes(1);
    expect(metrics.recordDeviceIngestionDuplicate).not.toHaveBeenCalled();
    expect(metrics.recordDeviceIngestionRejected).not.toHaveBeenCalled();
  });

  it('returns duplicate_accepted when idempotency unique constraint is hit', async () => {
    const context = buildContext();
    const dto = buildDto();
    const { service, prisma, metrics } = createService();
    const duplicateReceivedAt = new Date('2026-03-05T12:00:03.000Z');

    prisma.$transaction.mockRejectedValue({
      code: 'P2002',
      meta: {
        target: ['ownerId', 'deviceId', 'eventId'],
      },
    });
    prisma.deviceEventInbox.findFirst.mockResolvedValue({
      id: 'inbox-dup-1',
      receivedAt: duplicateReceivedAt,
    });
    prisma.deviceIngestionKey.update.mockResolvedValue({});

    const response = await service.ingestEvent(context, dto);

    expect(response.status).toBe('duplicate_accepted');
    expect(response.inboxId).toBe('inbox-dup-1');
    expect(metrics.recordDeviceIngestionDuplicate).toHaveBeenCalledTimes(1);
    expect(metrics.recordDeviceIngestionAccepted).not.toHaveBeenCalled();
    expect(metrics.recordDeviceIngestionRejected).not.toHaveBeenCalled();
  });

  it('rejects source mismatch and records rejected metric', async () => {
    const context = buildContext();
    const dto = buildDto({
      source: {
        ...buildDto().source,
        deviceId: 'another-device',
      },
    });
    const { service, metrics } = createService();

    await expect(service.ingestEvent(context, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(metrics.recordDeviceIngestionRejected).toHaveBeenCalledTimes(1);
    expect(metrics.recordDeviceIngestionAccepted).not.toHaveBeenCalled();
    expect(metrics.recordDeviceIngestionDuplicate).not.toHaveBeenCalled();
  });

  it('resolves device auth context from ingestion key', async () => {
    const { service, prisma, metrics } = createService();
    prisma.deviceIngestionKey.findUnique.mockResolvedValue({
      id: 'key-1',
      revokedAt: null,
      device: {
        id: 'device-1',
        ownerId: 'owner-1',
        ownerTenantId: 'tenant-1',
        status: DeviceStatus.ASSIGNED,
        isConfigured: true,
        macAddress: 'AA:BB:CC:DD:EE:FF',
        system: {
          code: HardwareSystemCode.RFID_PRESENCE,
        },
      },
    });

    const context = await service.resolveDeviceAuthContext('dik_abcdefghijklmnopqrstuvwxyz123456');

    expect(context).toEqual({
      keyId: 'key-1',
      ownerId: 'owner-1',
      ownerTenantId: 'tenant-1',
      deviceId: 'device-1',
      systemCode: HardwareSystemCode.RFID_PRESENCE,
      macAddress: 'AA:BB:CC:DD:EE:FF',
    });
    expect(metrics.recordDeviceIngestionAuthFailure).not.toHaveBeenCalled();
  });

  it('rejects invalid ingestion key format and records auth failure metric', async () => {
    const { service, metrics } = createService();

    await expect(service.resolveDeviceAuthContext('short')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(metrics.recordDeviceIngestionAuthFailure).toHaveBeenCalledTimes(1);
  });
});
