import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeviceStatus, OutboxEventType, Prisma } from '@prisma/client';
import { GetMyDevicesQueryDto } from './dto/get-my-devices-query.dto';
import { DevicesService } from './devices.service';

describe('DevicesService', () => {
  const prisma = {
    device: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    identifier: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const stockLedgerService = {
    append: jest.fn(),
  };

  const outboxService = {
    enqueue: jest.fn(),
  };

  let service: DevicesService;

  beforeEach(() => {
    service = new DevicesService(
      prisma as any,
      stockLedgerService as any,
      outboxService as any,
    );
  });

  it('maps Prisma cursor misses to a bad request', async () => {
    prisma.device.findMany.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Missing cursor', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(service.getMyDevices('owner-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns paginated device and standalone identifier slices', async () => {
    const query = Object.assign(new GetMyDevicesQueryDto(), {
      devicesLimit: 1,
      standaloneLimit: 1,
    });

    prisma.device.findMany.mockResolvedValueOnce([
      { id: 'device-1', identifiers: [] },
      { id: 'device-2', identifiers: [] },
    ]);
    prisma.identifier.findMany.mockResolvedValueOnce([
      { id: 'identifier-1' },
      { id: 'identifier-2' },
    ]);

    await expect(service.getMyDevices('owner-1', query)).resolves.toEqual({
      devices: [{ id: 'device-1', identifiers: [] }],
      standaloneIdentifiers: [{ id: 'identifier-1' }],
      pagination: {
        devices: {
          nextCursor: 'device-1',
          hasMore: true,
          limit: 1,
        },
        standaloneIdentifiers: {
          nextCursor: 'identifier-1',
          hasMore: true,
          limit: 1,
        },
      },
    });
  });

  it('throws when configuring a device outside the current account', async () => {
    prisma.device.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.configureMyDevice('owner-1', 'device-1', {
        name: 'Desk unit',
        location: 'Reception',
        systemIdentifier: 'AA:BB:CC:DD:EE:FF',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when the provided MAC does not match the allocated device', async () => {
    prisma.device.findFirst.mockResolvedValueOnce({
      id: 'device-1',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      status: DeviceStatus.ASSIGNED,
    });

    await expect(
      service.configureMyDevice('owner-1', 'device-1', {
        name: 'Desk unit',
        location: 'Reception',
        systemIdentifier: '11:22:33:44:55:66',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates the device, appends a ledger event, and enqueues activation', async () => {
    const tx = {
      device: {
        update: jest.fn(),
      },
    };

    prisma.device.findFirst.mockResolvedValueOnce({
      id: 'device-1',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      status: DeviceStatus.ASSIGNED,
    });
    tx.device.update.mockResolvedValueOnce({
      id: 'device-1',
      systemId: 'system-1',
      ownerTenantId: 'tenant-1',
      warehouseCode: 'MAIN',
      configuredName: 'Desk unit',
      configuredLocation: 'Reception',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      system: {
        code: 'RFID_PRESENCE',
      },
      identifiers: [],
    });
    prisma.$transaction.mockImplementationOnce(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    stockLedgerService.append.mockResolvedValueOnce(undefined);
    outboxService.enqueue.mockResolvedValueOnce(undefined);

    const result = await service.configureMyDevice('owner-1', 'device-1', {
      name: ' Desk unit ',
      location: 'Reception',
      systemIdentifier: 'aa-bb-cc-dd-ee-ff',
    } as any);

    expect(tx.device.update).toHaveBeenCalledWith({
      where: {
        id: 'device-1',
      },
      data: {
        configuredName: 'Desk unit',
        configuredLocation: 'Reception',
        isConfigured: true,
      },
      include: {
        system: true,
        identifiers: {
          where: {
            ownerId: 'owner-1',
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    expect(stockLedgerService.append).toHaveBeenCalledTimes(1);
    expect(outboxService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: OutboxEventType.DEVICE_ACTIVATED,
        aggregateId: 'device-1',
      }),
      tx,
    );
    expect(result).toMatchObject({
      id: 'device-1',
      configuredName: 'Desk unit',
      configuredLocation: 'Reception',
    });
  });
});
