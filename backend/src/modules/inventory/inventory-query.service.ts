import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DeviceStatus,
  IdentifierStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BusinessSystemsService } from '../systems/business-systems.service';
import type {
  ListAdminInventoryInput,
  SystemStockOverview,
  WarehouseStockSnapshot,
} from './inventory.types';
import { InventoryValidationService } from './inventory-validation.service';

@Injectable()
export class InventoryQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessSystemsService: BusinessSystemsService,
    private readonly inventoryValidationService: InventoryValidationService,
  ) {}

  async listSystemsWithStock(includeInactive = false): Promise<SystemStockOverview[]> {
    const systems = includeInactive
      ? await this.businessSystemsService.listAdminSystems()
      : await this.businessSystemsService.listActiveSystems();

    if (systems.length === 0) {
      return [];
    }

    const systemIds = systems.map((system) => system.id);

    const [deviceGroups, extensionGroups] = await Promise.all([
      this.prisma.device.groupBy({
        by: ['systemId'],
        where: {
          systemId: {
            in: systemIds,
          },
          status: DeviceStatus.IN_STOCK,
          ownerId: null,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.identifier.groupBy({
        by: ['systemId'],
        where: {
          systemId: {
            in: systemIds,
          },
          status: IdentifierStatus.IN_STOCK,
          ownerId: null,
          deviceId: null,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const deviceCountBySystem = new Map(
      deviceGroups.map((entry) => [entry.systemId, entry._count._all]),
    );
    const extensionCountBySystem = new Map(
      extensionGroups.map((entry) => [entry.systemId, entry._count._all]),
    );

    return systems.map((system) => {
      const supportsIdentifiers = this.inventoryValidationService.supportsIdentifiers(system);
      const availableDevices = deviceCountBySystem.get(system.id) ?? 0;
      const availableExtensions = supportsIdentifiers
        ? (extensionCountBySystem.get(system.id) ?? 0)
        : 0;
      const isLowStock =
        availableDevices <= system.lowStockThreshold ||
        (supportsIdentifiers && availableExtensions <= system.lowStockThreshold);

      return {
        id: system.id,
        name: system.name,
        code: system.code,
        hasIdentifiers: supportsIdentifiers,
        identifiersPerDevice: supportsIdentifiers ? system.identifiersPerDevice : 0,
        identifierType: supportsIdentifiers ? system.identifierType : null,
        deviceUnitPriceCents: system.deviceUnitPriceCents,
        extensionUnitPriceCents: supportsIdentifiers ? system.extensionUnitPriceCents : 0,
        currency: system.currency,
        isActive: system.isActive,
        lowStockThreshold: system.lowStockThreshold,
        availableDevices,
        availableExtensions,
        isLowStock,
      };
    });
  }

  async listDeviceInventory(input: ListAdminInventoryInput) {
    const where = await this.inventoryValidationService.buildDeviceInventoryWhere(input);

    const [total, items] = await Promise.all([
      this.prisma.device.count({ where }),
      this.prisma.device.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: {
          system: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          identifiers: {
            orderBy: { createdAt: 'asc' },
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page: input.page,
      limit: input.limit,
      items,
    };
  }

  async getDeviceInventoryDetail(deviceId: string) {
    const [device, movements, adminLogs] = await Promise.all([
      this.prisma.device.findUnique({
        where: { id: deviceId },
        include: {
          system: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          identifiers: {
            orderBy: { createdAt: 'asc' },
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          allocations: {
            orderBy: { createdAt: 'desc' },
            include: {
              order: {
                include: {
                  customer: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.stockMovement.findMany({
        where: {
          OR: [{ deviceId }, { identifier: { deviceId } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          system: true,
          device: {
            select: {
              id: true,
              macAddress: true,
            },
          },
          identifier: {
            select: {
              id: true,
              physicalIdentifier: true,
            },
          },
        },
      }),
      this.prisma.adminActionLog.findMany({
        where: {
          targetType: 'DEVICE',
          targetId: deviceId,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    if (!device) {
      throw new NotFoundException('Boitier introuvable.');
    }

    return {
      device,
      movements,
      adminLogs,
    };
  }

  async listLowStockAlerts() {
    const [systems, snapshots] = await Promise.all([
      this.businessSystemsService.listAdminSystems(),
      this.getWarehouseStockSnapshot(),
    ]);

    const snapshotsBySystem = systems.flatMap((system) => {
      const systemSnapshots = snapshots.filter((snapshot) => snapshot.systemId === system.id);
      if (systemSnapshots.length > 0) {
        return systemSnapshots;
      }

      return [
        {
          systemId: system.id,
          warehouseCode: 'MAIN',
          availableDevices: 0,
          availableExtensions: 0,
        },
      ];
    });

    return snapshotsBySystem
      .map((snapshot) => {
        const system = systems.find((entry) => entry.id === snapshot.systemId);
        if (!system) {
          return null;
        }
        const supportsIdentifiers = this.inventoryValidationService.supportsIdentifiers(system);
        const availableExtensions = supportsIdentifiers ? snapshot.availableExtensions : 0;

        const isDeviceLow = snapshot.availableDevices <= system.lowStockThreshold;
        const isExtensionLow =
          supportsIdentifiers && availableExtensions <= system.lowStockThreshold;

        if (!isDeviceLow && !isExtensionLow) {
          return null;
        }

        return {
          systemId: system.id,
          systemName: system.name,
          systemCode: system.code,
          warehouseCode: snapshot.warehouseCode,
          threshold: system.lowStockThreshold,
          availableDevices: snapshot.availableDevices,
          availableExtensions,
          recommendedDeviceRestock: Math.max(system.lowStockThreshold * 2 - snapshot.availableDevices, 0),
          recommendedExtensionRestock: supportsIdentifiers
            ? Math.max(system.lowStockThreshold * 2 - availableExtensions, 0)
            : 0,
          severity: isDeviceLow && isExtensionLow ? 'critical' : 'warning',
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }

  private async getWarehouseStockSnapshot(): Promise<WarehouseStockSnapshot[]> {
    const [devicesByWarehouse, extensionsByWarehouse] = await Promise.all([
      this.prisma.device.groupBy({
        by: ['systemId', 'warehouseCode'],
        where: {
          status: DeviceStatus.IN_STOCK,
          ownerId: null,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.identifier.groupBy({
        by: ['systemId', 'warehouseCode'],
        where: {
          status: IdentifierStatus.IN_STOCK,
          ownerId: null,
          deviceId: null,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const map = new Map<string, WarehouseStockSnapshot>();
    const touchSnapshot = (systemId: string, warehouseCode: string): WarehouseStockSnapshot => {
      const normalizedWarehouse = warehouseCode || 'MAIN';
      const key = `${systemId}:${normalizedWarehouse}`;
      const existing = map.get(key);
      if (existing) {
        return existing;
      }
      const created: WarehouseStockSnapshot = {
        systemId,
        warehouseCode: normalizedWarehouse,
        availableDevices: 0,
        availableExtensions: 0,
      };
      map.set(key, created);
      return created;
    };

    devicesByWarehouse.forEach((entry) => {
      const snapshot = touchSnapshot(entry.systemId, entry.warehouseCode || 'MAIN');
      snapshot.availableDevices = entry._count._all;
    });

    extensionsByWarehouse.forEach((entry) => {
      const snapshot = touchSnapshot(entry.systemId, entry.warehouseCode || 'MAIN');
      snapshot.availableExtensions = entry._count._all;
    });

    return Array.from(map.values());
  }
}
