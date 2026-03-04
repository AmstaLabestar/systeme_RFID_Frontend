import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeviceStatus, OutboxEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StockLedgerService } from '../inventory/stock-ledger.service';
import { OutboxService } from '../outbox/outbox.service';
import { ConfigureDeviceDto } from './dto/configure-device.dto';
import { GetMyDevicesQueryDto } from './dto/get-my-devices-query.dto';
import type { GetMyDevicesResponseDto } from './dto/get-my-devices-response.dto';

const MAC_ADDRESS_REGEX = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

function normalizeMacAddress(value: string): string {
  const normalized = value.trim().toUpperCase().replaceAll('-', ':');
  if (!MAC_ADDRESS_REGEX.test(normalized)) {
    throw new BadRequestException('Adresse MAC invalide. Format attendu: AA:BB:CC:DD:EE:FF');
  }
  return normalized;
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockLedgerService: StockLedgerService,
    private readonly outboxService: OutboxService,
  ) {}

  async getMyDevices(
    ownerId: string,
    query: GetMyDevicesQueryDto = new GetMyDevicesQueryDto(),
  ): Promise<GetMyDevicesResponseDto> {
    const paginate = query.paginate;
    const devicesTake = paginate ? query.devicesLimit + 1 : undefined;
    const standaloneTake = paginate ? query.standaloneLimit + 1 : undefined;

    const [rawDevices, rawStandaloneIdentifiers] = await (async () => {
      try {
        return await Promise.all([
          this.prisma.device.findMany({
            where: {
              ownerId,
              status: DeviceStatus.ASSIGNED,
            },
            ...(paginate && query.devicesCursor
              ? {
                  cursor: { id: query.devicesCursor },
                  skip: 1,
                }
              : {}),
            orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
            ...(devicesTake ? { take: devicesTake } : {}),
            include: {
              system: true,
              identifiers: {
                where: {
                  ownerId,
                },
                orderBy: { createdAt: 'asc' },
                include: {
                  serviceAssignment: {
                    select: {
                      employeeId: true,
                      deviceId: true,
                    },
                  },
                },
              },
            },
          }),
          this.prisma.identifier.findMany({
            where: {
              ownerId,
              deviceId: null,
            },
            ...(paginate && query.standaloneCursor
              ? {
                  cursor: { id: query.standaloneCursor },
                  skip: 1,
                }
              : {}),
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            ...(standaloneTake ? { take: standaloneTake } : {}),
            include: {
              system: true,
              serviceAssignment: {
                select: {
                  employeeId: true,
                  deviceId: true,
                },
              },
            },
          }),
        ]);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new BadRequestException('Cursor de pagination invalide.');
        }
        throw error;
      }
    })();

    const hasMoreDevices = paginate && rawDevices.length > query.devicesLimit;
    const hasMoreStandalone = paginate && rawStandaloneIdentifiers.length > query.standaloneLimit;
    const devices = hasMoreDevices ? rawDevices.slice(0, query.devicesLimit) : rawDevices;
    const standaloneIdentifiers = hasMoreStandalone
      ? rawStandaloneIdentifiers.slice(0, query.standaloneLimit)
      : rawStandaloneIdentifiers;

    return {
      devices,
      standaloneIdentifiers,
      pagination: {
        devices: {
          nextCursor: hasMoreDevices ? (devices[devices.length - 1]?.id ?? null) : null,
          hasMore: hasMoreDevices,
          limit: query.devicesLimit,
        },
        standaloneIdentifiers: {
          nextCursor: hasMoreStandalone
            ? (standaloneIdentifiers[standaloneIdentifiers.length - 1]?.id ?? null)
            : null,
          hasMore: hasMoreStandalone,
          limit: query.standaloneLimit,
        },
      },
    };
  }

  async configureMyDevice(ownerId: string, deviceId: string, dto: ConfigureDeviceDto) {
    const device = await this.prisma.device.findFirst({
      where: {
        id: deviceId,
        ownerId,
        status: DeviceStatus.ASSIGNED,
      },
    });

    if (!device) {
      throw new NotFoundException('Boitier introuvable pour ce compte.');
    }

    const normalizedSystemIdentifier = normalizeMacAddress(dto.systemIdentifier);
    if (normalizeMacAddress(device.macAddress) !== normalizedSystemIdentifier) {
      throw new BadRequestException(
        'La MAC fournie ne correspond pas a la MAC physique allouee pour ce boitier.',
      );
    }
    const normalizedConfiguredName = dto.name?.trim();

    return this.prisma.$transaction(async (tx) => {
      const updatedDevice = await tx.device.update({
        where: {
          id: device.id,
        },
        data: {
          configuredName:
            normalizedConfiguredName && normalizedConfiguredName.length > 0
              ? normalizedConfiguredName
              : null,
          configuredLocation: dto.location.trim(),
          isConfigured: true,
        },
        include: {
          system: true,
          identifiers: {
            where: {
              ownerId,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      await this.stockLedgerService.append(
        [
          {
            resourceType: 'DEVICE',
            resourceId: updatedDevice.id,
            systemId: updatedDevice.systemId,
            deviceId: updatedDevice.id,
            action: 'CONFIGURED',
            warehouseCode: updatedDevice.warehouseCode,
            ownerId,
            fromStatus: DeviceStatus.ASSIGNED,
            toStatus: DeviceStatus.ASSIGNED,
            details: {
              name: updatedDevice.configuredName,
              location: updatedDevice.configuredLocation,
              configuredAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          },
        ],
        tx,
      );

      await this.outboxService.enqueue(
        {
          eventType: OutboxEventType.DEVICE_ACTIVATED,
          aggregateType: 'DEVICE',
          aggregateId: updatedDevice.id,
          tenantId: updatedDevice.ownerTenantId,
          systemId: updatedDevice.systemId,
          deviceId: updatedDevice.id,
          payload: {
            deviceId: updatedDevice.id,
            ownerId,
            systemCode: updatedDevice.system.code,
            configuredName: updatedDevice.configuredName,
            configuredLocation: updatedDevice.configuredLocation,
            macAddress: updatedDevice.macAddress,
          },
        },
        tx,
      );

      return updatedDevice;
    });
  }
}
