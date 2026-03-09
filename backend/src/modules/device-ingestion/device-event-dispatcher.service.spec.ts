import { DeviceEventDispatcherService } from './device-event-dispatcher.service';
import { HardwareSystemCode } from '@prisma/client';

type AnyMock = jest.Mock<any, any>;

interface MetricsMock {
  recordDeviceDispatchProcessed: AnyMock;
  recordDeviceDispatchFailure: AnyMock;
}

interface PresenceRealtimeMock {
  publishScan: AnyMock;
}

function createService() {
  const tx = {
    deviceEventInbox: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    serviceAssignment: {
      findFirst: jest.fn(),
    },
    serviceHistoryEvent: {
      create: jest.fn(),
    },
  };

  const prisma = {
    deviceEventInbox: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const configService = {
    get: jest.fn((_key: string) => undefined),
  };

  const metrics: MetricsMock = {
    recordDeviceDispatchProcessed: jest.fn(),
    recordDeviceDispatchFailure: jest.fn(),
  };

  const presenceRealtime: PresenceRealtimeMock = {
    publishScan: jest.fn(),
  };

  const service = new DeviceEventDispatcherService(
    prisma as any,
    configService as any,
    metrics as any,
    presenceRealtime as any,
  );

  return {
    service,
    prisma,
    tx,
    metrics,
    presenceRealtime,
  };
}

describe('DeviceEventDispatcherService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('marks pending inbox events as processed', async () => {
    const { service, prisma, tx, metrics, presenceRealtime } = createService();
    prisma.deviceEventInbox.findMany.mockResolvedValue([{ id: 'evt-1' }]);
    prisma.$transaction.mockImplementation(async (callback: AnyMock) => callback(tx));

    tx.deviceEventInbox.findFirst.mockResolvedValue({
      id: 'evt-1',
      ownerId: 'owner-1',
      deviceId: 'device-1',
      systemCode: HardwareSystemCode.RFID_PRESENCE,
      eventId: 'event-1',
      eventType: 'badge.scanned',
      processedAt: null,
      device: {
        configuredName: 'Accueil',
        system: {
          name: 'RFID Presence',
        },
      },
      eventStore: {
        sourceSequence: 7n,
        payload: {
          badgeCode: 'ABCD1234',
        },
      },
    });
    tx.serviceAssignment.findFirst.mockResolvedValue({
      id: 'assignment-1',
      employeeId: 'employee-1',
      identifierId: 'identifier-1',
      employee: {
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
      identifier: {
        physicalIdentifier: 'ABCD1234',
      },
      device: {
        configuredName: 'Accueil',
        system: {
          name: 'RFID Presence',
        },
      },
    });
    tx.serviceHistoryEvent.create.mockResolvedValue({
      id: 'history-1',
      occurredAt: new Date('2026-03-05T12:00:03.000Z'),
    });
    tx.deviceEventInbox.updateMany.mockResolvedValue({ count: 1 });

    await service.dispatchPendingEvents();

    expect(prisma.deviceEventInbox.findMany).toHaveBeenCalledTimes(1);
    expect(tx.serviceHistoryEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.deviceEventInbox.updateMany).toHaveBeenCalledTimes(1);
    expect(presenceRealtime.publishScan).toHaveBeenCalledTimes(1);
    expect(metrics.recordDeviceDispatchProcessed).toHaveBeenCalledTimes(1);
    expect(metrics.recordDeviceDispatchFailure).not.toHaveBeenCalled();
  });

  it('records failure metric when one event dispatch fails', async () => {
    const { service, prisma, metrics } = createService();
    prisma.deviceEventInbox.findMany.mockResolvedValue([{ id: 'evt-1' }]);
    prisma.$transaction.mockRejectedValue(new Error('dispatch failure'));

    await service.dispatchPendingEvents();

    expect(metrics.recordDeviceDispatchFailure).toHaveBeenCalledTimes(1);
  });

  it('records failure metric when dispatcher loop query throws', async () => {
    const { service, prisma, metrics } = createService();
    prisma.deviceEventInbox.findMany.mockRejectedValue(new Error('db offline'));

    await service.dispatchPendingEvents();

    expect(metrics.recordDeviceDispatchFailure).toHaveBeenCalledTimes(1);
  });
});
