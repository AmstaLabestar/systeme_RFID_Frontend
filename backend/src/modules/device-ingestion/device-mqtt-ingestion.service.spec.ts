import { BadRequestException } from '@nestjs/common';
import { HardwareSystemCode } from '@prisma/client';
import { DeviceMqttIngestionService } from './device-mqtt-ingestion.service';

type AnyMock = jest.Mock<any, any>;

interface ConfigMock {
  get: AnyMock;
}

interface DeviceIngestionServiceMock {
  resolveDeviceAuthContext: AnyMock;
  ingestEvent: AnyMock;
}

interface MetricsMock {
  recordDeviceIngestionRejected: AnyMock;
}

function createService() {
  const configService: ConfigMock = {
    get: jest.fn((_key: string) => undefined),
  };

  const ingestionService: DeviceIngestionServiceMock = {
    resolveDeviceAuthContext: jest.fn(),
    ingestEvent: jest.fn(),
  };

  const metricsService: MetricsMock = {
    recordDeviceIngestionRejected: jest.fn(),
  };

  const service = new DeviceMqttIngestionService(
    configService as any,
    ingestionService as any,
    metricsService as any,
  );

  return {
    service,
    configService,
    ingestionService,
    metricsService,
  };
}

describe('DeviceMqttIngestionService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes standard MQTT event payload and forwards it to ingestion pipeline', async () => {
    const { service, ingestionService, metricsService } = createService();
    ingestionService.resolveDeviceAuthContext.mockResolvedValue({
      keyId: 'key-1',
      ownerId: 'owner-1',
      ownerTenantId: 'tenant-1',
      deviceId: 'device-1',
      systemCode: HardwareSystemCode.RFID_PRESENCE,
      macAddress: 'AA:BB:CC:DD:EE:FF',
    });
    ingestionService.ingestEvent.mockResolvedValue({
      status: 'accepted',
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      inboxId: 'inbox-1',
      receivedAt: '2026-03-05T12:00:01.000Z',
    });

    const payload = Buffer.from(
      JSON.stringify({
        ingestionKey: 'dik_abcdefghijklmnopqrstuvwxyz123456',
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        systemCode: 'RFID_PRESENCE',
        eventType: 'badge.scanned',
        occurredAt: '2026-03-05T12:00:00.000Z',
        sentAt: '2026-03-05T12:00:00.500Z',
        deviceMac: 'AA:BB:CC:DD:EE:FF',
        payload: {
          badgeCode: 'ABCD1234',
        },
      }),
      'utf8',
    );

    await service.processBrokerMessage('devices/device-1/events', payload);

    expect(ingestionService.resolveDeviceAuthContext).toHaveBeenCalledTimes(1);
    expect(ingestionService.resolveDeviceAuthContext).toHaveBeenCalledWith(
      'dik_abcdefghijklmnopqrstuvwxyz123456',
    );
    expect(ingestionService.ingestEvent).toHaveBeenCalledTimes(1);
    expect(ingestionService.ingestEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'device-1',
      }),
      expect.objectContaining({
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        eventType: 'badge.scanned',
        source: expect.objectContaining({
          deviceId: 'device-1',
          systemCode: HardwareSystemCode.RFID_PRESENCE,
        }),
      }),
    );
    expect(metricsService.recordDeviceIngestionRejected).not.toHaveBeenCalled();
  });

  it('rejects malformed MQTT payload and records rejected metric', async () => {
    const { service, metricsService } = createService();

    await expect(
      service.processBrokerMessage('devices/device-1/events', Buffer.from('not-a-json', 'utf8')),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(metricsService.recordDeviceIngestionRejected).toHaveBeenCalledTimes(1);
  });
});
