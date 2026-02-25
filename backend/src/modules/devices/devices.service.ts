import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeviceStatus, OutboxEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StockLedgerService } from '../inventory/stock-ledger.service';
import { OutboxService } from '../outbox/outbox.service';
import { ConfigureDeviceDto } from './dto/configure-device.dto';

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

  getMyDevices(ownerId: string) {
    return Promise.all([
      this.prisma.device.findMany({
        where: {
          ownerId,
          status: DeviceStatus.ASSIGNED,
        },
        orderBy: { assignedAt: 'desc' },
        include: {
          system: true,
          identifiers: {
            where: {
              ownerId,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.identifier.findMany({
        where: {
          ownerId,
          deviceId: null,
        },
        orderBy: { createdAt: 'asc' },
        include: {
          system: true,
        },
      }),
    ]).then(([devices, standaloneIdentifiers]) => ({
      devices,
      standaloneIdentifiers,
    }));
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

    return this.prisma.$transaction(async (tx) => {
      const updatedDevice = await tx.device.update({
        where: {
          id: device.id,
        },
        data: {
          configuredName: dto.name.trim(),
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
