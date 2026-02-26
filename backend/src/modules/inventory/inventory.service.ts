import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeviceStatus,
  HardwareSystemCode,
  IdentifierStatus,
  IdentifierType,
  Prisma,
  type BusinessSystem,
  type Device,
  type Identifier,
} from '@prisma/client';
import { sanitizeString } from '../../common/utils/security.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { IdentifiersService } from '../identifiers/identifiers.service';
import { BusinessSystemsService } from '../systems/business-systems.service';
import { StockLedgerService } from './stock-ledger.service';

const MAC_ADDRESS_REGEX = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
const WAREHOUSE_CODE_REGEX = /^[A-Z0-9_-]{2,40}$/;

interface DeviceSeedInput {
  macAddress: string;
  identifiers?: string[];
  warehouseCode?: string;
}

interface CreateDevicesInBulkInput {
  systemId: string;
  quantity: number;
  devices: DeviceSeedInput[];
  createdById: string;
  warehouseCode?: string;
}

interface AddIdentifiersToDeviceInput {
  deviceId: string;
  physicalIdentifiers: string[];
  type?: IdentifierType;
  createdById: string;
}

interface AddIdentifiersToSystemInput {
  systemId: string;
  physicalIdentifiers: string[];
  type?: IdentifierType;
  createdById: string;
  warehouseCode?: string;
}

export interface SystemStockOverview {
  id: string;
  name: string;
  code: BusinessSystem['code'];
  hasIdentifiers: boolean;
  identifiersPerDevice: number;
  identifierType: BusinessSystem['identifierType'];
  deviceUnitPriceCents: number;
  extensionUnitPriceCents: number;
  currency: string;
  isActive: boolean;
  lowStockThreshold: number;
  availableDevices: number;
  availableExtensions: number;
  isLowStock: boolean;
}

export interface ListAdminInventoryInput {
  page: number;
  limit: number;
  systemId?: string;
  systemCode?: HardwareSystemCode;
  status?: DeviceStatus;
  warehouseCode?: string;
  search?: string;
}

interface WarehouseStockSnapshot {
  systemId: string;
  warehouseCode: string;
  availableDevices: number;
  availableExtensions: number;
}

export interface DeviceImportValidationIssue {
  field: 'macAddress' | 'identifiers' | 'warehouseCode';
  code: string;
  message: string;
}

export interface DeviceImportValidationRow {
  rowNumber: number;
  macAddress: string;
  warehouseCode: string;
  identifiers: string[];
  issues: DeviceImportValidationIssue[];
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessSystemsService: BusinessSystemsService,
    private readonly identifiersService: IdentifiersService,
    private readonly stockLedgerService: StockLedgerService,
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
      const supportsIdentifiers = this.supportsIdentifiers(system);
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

  async createDevicesInBulk(input: CreateDevicesInBulkInput): Promise<Device[]> {
    const system = await this.businessSystemsService.getSystemByIdOrThrow(input.systemId);
    const supportsIdentifiers = this.supportsIdentifiers(system);

    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('quantity doit etre un entier strictement positif.');
    }

    if (!Array.isArray(input.devices) || input.devices.length !== input.quantity) {
      throw new BadRequestException(
        'Le nombre de boitiers detaille doit correspondre exactement a quantity.',
      );
    }

    const normalizedDevices = this.normalizeDeviceBatch(input.devices, system, input.warehouseCode);

    if (supportsIdentifiers && !system.identifierType) {
      throw new BadRequestException('Configuration systeme invalide: identifierType manquant.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const createdDevices: Device[] = [];
        const ledgerEntries: Parameters<StockLedgerService['append']>[0] = [];

        for (const deviceInput of normalizedDevices) {
          // Business invariant: purchase never creates hardware, it only allocates pre-provisioned stock.
          const device = await tx.device.create({
            data: {
              systemId: system.id,
              macAddress: deviceInput.macAddress,
              status: DeviceStatus.IN_STOCK,
              warehouseCode: deviceInput.warehouseCode,
              createdById: input.createdById,
            },
          });
          createdDevices.push(device);

          ledgerEntries.push({
            resourceType: 'DEVICE',
            resourceId: device.id,
            systemId: system.id,
            deviceId: device.id,
            action: 'STOCK_CREATED',
            warehouseCode: device.warehouseCode,
            actorId: input.createdById,
            toStatus: DeviceStatus.IN_STOCK,
          });

          if (supportsIdentifiers) {
            const createdIdentifiers = await this.identifiersService.createIdentifiers(
              {
                systemId: system.id,
                deviceId: device.id,
                type: system.identifierType as IdentifierType,
                physicalIdentifiers: deviceInput.identifiers,
                warehouseCode: device.warehouseCode,
                createdById: input.createdById,
              },
              tx,
            );

            createdIdentifiers.forEach((identifier) => {
              ledgerEntries.push({
                resourceType: 'IDENTIFIER',
                resourceId: identifier.id,
                systemId: system.id,
                deviceId: device.id,
                identifierId: identifier.id,
                action: 'STOCK_CREATED',
                warehouseCode: identifier.warehouseCode,
                actorId: input.createdById,
                toStatus: IdentifierStatus.IN_STOCK,
              });
            });
          }
        }

        await this.stockLedgerService.append(ledgerEntries, tx);
        return createdDevices;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Contrainte d unicite violee (MAC ou identifiant physique deja enregistre).',
        );
      }
      throw error;
    }
  }

  async validateDeviceImportBatch(input: {
    systemId: string;
    devices: DeviceSeedInput[];
    warehouseCode?: string;
  }) {
    const system = await this.businessSystemsService.getSystemByIdOrThrow(input.systemId);
    const supportsIdentifiers = this.supportsIdentifiers(system);

    if (!Array.isArray(input.devices) || input.devices.length === 0) {
      throw new BadRequestException('Ajoutez au moins une ligne d import.');
    }

    const rows: DeviceImportValidationRow[] = [];
    const seenMacs = new Set<string>();
    const seenIdentifiers = new Set<string>();
    const defaultWarehouseCode = input.warehouseCode
      ? this.normalizeWarehouseCode(input.warehouseCode)
      : 'MAIN';

    for (let index = 0; index < input.devices.length; index += 1) {
      const sourceRow = input.devices[index];
      const issues: DeviceImportValidationIssue[] = [];
      let normalizedMacAddress = '';
      let normalizedWarehouseCode = defaultWarehouseCode;
      let normalizedIdentifiers: string[] = [];

      try {
        normalizedMacAddress = this.normalizeMacAddress(sourceRow.macAddress);
      } catch {
        issues.push({
          field: 'macAddress',
          code: 'INVALID_MAC',
          message: 'Adresse MAC invalide.',
        });
      }

      try {
        normalizedWarehouseCode = this.normalizeWarehouseCode(
          sourceRow.warehouseCode ?? defaultWarehouseCode,
        );
      } catch {
        issues.push({
          field: 'warehouseCode',
          code: 'INVALID_WAREHOUSE',
          message: 'Code entrepot invalide.',
        });
      }

      if (!supportsIdentifiers) {
        if (Array.isArray(sourceRow.identifiers) && sourceRow.identifiers.length > 0) {
          issues.push({
            field: 'identifiers',
            code: 'IDENTIFIERS_NOT_SUPPORTED',
            message: 'Ce systeme ne supporte pas les identifiants.',
          });
        }
      } else if (!Array.isArray(sourceRow.identifiers)) {
        issues.push({
          field: 'identifiers',
          code: 'IDENTIFIERS_MISSING',
          message: 'Identifiants manquants pour ce boitier.',
        });
      } else {
        if (sourceRow.identifiers.length !== system.identifiersPerDevice) {
          issues.push({
            field: 'identifiers',
            code: 'IDENTIFIERS_COUNT_MISMATCH',
            message: `Nombre d identifiants invalide (attendu: ${system.identifiersPerDevice}).`,
          });
        }

        try {
          normalizedIdentifiers = this.identifiersService.normalizePhysicalIdentifiers(
            sourceRow.identifiers,
          );
        } catch {
          issues.push({
            field: 'identifiers',
            code: 'INVALID_IDENTIFIER_FORMAT',
            message: 'Un ou plusieurs identifiants physiques sont invalides.',
          });
        }
      }

      if (normalizedMacAddress) {
        if (seenMacs.has(normalizedMacAddress)) {
          issues.push({
            field: 'macAddress',
            code: 'DUPLICATE_MAC_IN_FILE',
            message: 'Adresse MAC dupliquee dans le fichier import.',
          });
        } else {
          seenMacs.add(normalizedMacAddress);
        }
      }

      normalizedIdentifiers.forEach((identifier) => {
        if (seenIdentifiers.has(identifier)) {
          issues.push({
            field: 'identifiers',
            code: 'DUPLICATE_IDENTIFIER_IN_FILE',
            message: `Identifiant physique duplique dans le fichier (${identifier}).`,
          });
        } else {
          seenIdentifiers.add(identifier);
        }
      });

      rows.push({
        rowNumber: index + 1,
        macAddress: normalizedMacAddress,
        warehouseCode: normalizedWarehouseCode,
        identifiers: normalizedIdentifiers,
        issues,
      });
    }

    const macsToCheck = rows.map((row) => row.macAddress).filter((entry) => entry.length > 0);
    const identifiersToCheck = rows.flatMap((row) => row.identifiers);

    const [existingDevices, existingIdentifiers] = await Promise.all([
      macsToCheck.length > 0
        ? this.prisma.device.findMany({
            where: {
              macAddress: {
                in: macsToCheck,
              },
            },
            select: {
              macAddress: true,
            },
          })
        : Promise.resolve([]),
      identifiersToCheck.length > 0
        ? this.prisma.identifier.findMany({
            where: {
              physicalIdentifier: {
                in: identifiersToCheck,
              },
            },
            select: {
              physicalIdentifier: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const existingMacSet = new Set(existingDevices.map((device) => device.macAddress));
    const existingIdentifierSet = new Set(
      existingIdentifiers.map((identifier) => identifier.physicalIdentifier),
    );

    rows.forEach((row) => {
      if (row.macAddress && existingMacSet.has(row.macAddress)) {
        row.issues.push({
          field: 'macAddress',
          code: 'MAC_ALREADY_EXISTS',
          message: 'Adresse MAC deja en base.',
        });
      }

      row.identifiers.forEach((identifier) => {
        if (existingIdentifierSet.has(identifier)) {
          row.issues.push({
            field: 'identifiers',
            code: 'IDENTIFIER_ALREADY_EXISTS',
            message: `Identifiant physique deja en base (${identifier}).`,
          });
        }
      });
    });

    const invalidRows = rows.filter((row) => row.issues.length > 0).length;

    return {
      system: {
        id: system.id,
        name: system.name,
        code: system.code,
        hasIdentifiers: supportsIdentifiers,
        identifiersPerDevice: supportsIdentifiers ? system.identifiersPerDevice : 0,
      },
      summary: {
        totalRows: rows.length,
        validRows: rows.length - invalidRows,
        invalidRows,
      },
      canCommit: invalidRows === 0,
      rows,
    };
  }

  async addIdentifiersToDevice(input: AddIdentifiersToDeviceInput): Promise<Identifier[]> {
    const device = await this.prisma.device.findUnique({
      where: { id: input.deviceId },
      include: { system: true },
    });

    if (!device) {
      throw new NotFoundException('Boitier introuvable.');
    }

    const resolvedType = this.resolveIdentifierType({
      system: device.system,
      requestedType: input.type,
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const createdIdentifiers = await this.identifiersService.createIdentifiers(
          {
            systemId: device.systemId,
            deviceId: device.id,
            type: resolvedType,
            physicalIdentifiers: input.physicalIdentifiers,
            warehouseCode: device.warehouseCode,
            createdById: input.createdById,
          },
          tx,
        );

        await this.stockLedgerService.append(
          createdIdentifiers.map((identifier) => ({
            resourceType: 'IDENTIFIER' as const,
            resourceId: identifier.id,
            systemId: device.systemId,
            deviceId: device.id,
            identifierId: identifier.id,
            action: 'EXTENSION_STOCK_CREATED' as const,
            warehouseCode: identifier.warehouseCode,
            actorId: input.createdById,
            toStatus: IdentifierStatus.IN_STOCK,
          })),
          tx,
        );

        return createdIdentifiers;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un identifiant physique existe deja.');
      }
      throw error;
    }
  }

  async addIdentifiersToSystemStock(input: AddIdentifiersToSystemInput): Promise<Identifier[]> {
    const system = await this.businessSystemsService.getSystemByIdOrThrow(input.systemId);
    const resolvedType = this.resolveIdentifierType({
      system,
      requestedType: input.type,
    });
    const warehouseCode = this.normalizeWarehouseCode(input.warehouseCode ?? 'MAIN');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const createdIdentifiers = await this.identifiersService.createIdentifiers(
          {
            systemId: system.id,
            type: resolvedType,
            physicalIdentifiers: input.physicalIdentifiers,
            warehouseCode,
            createdById: input.createdById,
          },
          tx,
        );

        await this.stockLedgerService.append(
          createdIdentifiers.map((identifier) => ({
            resourceType: 'IDENTIFIER' as const,
            resourceId: identifier.id,
            systemId: system.id,
            identifierId: identifier.id,
            action: 'EXTENSION_STOCK_CREATED' as const,
            warehouseCode: identifier.warehouseCode,
            actorId: input.createdById,
            toStatus: IdentifierStatus.IN_STOCK,
          })),
          tx,
        );

        return createdIdentifiers;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un identifiant physique existe deja.');
      }
      throw error;
    }
  }

  async listDeviceInventory(input: ListAdminInventoryInput) {
    const where = await this.buildDeviceInventoryWhere(input);

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
        const supportsIdentifiers = this.supportsIdentifiers(system);
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

  private normalizeDeviceBatch(
    devices: DeviceSeedInput[],
    system: BusinessSystem,
    defaultWarehouseCode?: string,
  ): Array<{ macAddress: string; identifiers: string[]; warehouseCode: string }> {
    const supportsIdentifiers = this.supportsIdentifiers(system);
    const normalizedMacs = new Set<string>();
    const normalizedPhysicalIdentifiers = new Set<string>();
    const normalizedDefaultWarehouseCode = defaultWarehouseCode
      ? this.normalizeWarehouseCode(defaultWarehouseCode)
      : undefined;

    return devices.map((device, index) => {
      const macAddress = this.normalizeMacAddress(device.macAddress);

      if (normalizedMacs.has(macAddress)) {
        throw new BadRequestException(`Adresse MAC dupliquee dans la requete (position ${index + 1}).`);
      }
      normalizedMacs.add(macAddress);

      const warehouseCode = this.normalizeWarehouseCode(
        device.warehouseCode ?? normalizedDefaultWarehouseCode ?? 'MAIN',
      );

      if (!supportsIdentifiers) {
        if (Array.isArray(device.identifiers) && device.identifiers.length > 0) {
          throw new BadRequestException('Ce systeme ne supporte pas les identifiants materiels.');
        }
        return {
          macAddress,
          warehouseCode,
          identifiers: [],
        };
      }

      if (!Array.isArray(device.identifiers)) {
        throw new BadRequestException('Chaque boitier doit contenir ses identifiants physiques.');
      }

      if (device.identifiers.length !== system.identifiersPerDevice) {
        throw new BadRequestException(
          `Chaque boitier doit contenir exactement ${system.identifiersPerDevice} identifiants.`,
        );
      }

      const normalizedIdentifiers = this.identifiersService.normalizePhysicalIdentifiers(
        device.identifiers,
      );

      normalizedIdentifiers.forEach((physicalIdentifier) => {
        if (normalizedPhysicalIdentifiers.has(physicalIdentifier)) {
          throw new BadRequestException(
            'Chaque identifiant physique doit etre unique dans le lot soumis.',
          );
        }
        normalizedPhysicalIdentifiers.add(physicalIdentifier);
      });

      return {
        macAddress,
        warehouseCode,
        identifiers: normalizedIdentifiers,
      };
    });
  }

  private normalizeMacAddress(value: string): string {
    const normalized = sanitizeString(String(value))
      .toUpperCase()
      .replaceAll('-', ':');

    if (!MAC_ADDRESS_REGEX.test(normalized)) {
      throw new BadRequestException('Adresse MAC invalide. Format attendu: AA:BB:CC:DD:EE:FF');
    }

    return normalized;
  }

  private normalizeWarehouseCode(value: string): string {
    const normalized = sanitizeString(String(value)).toUpperCase();
    if (!WAREHOUSE_CODE_REGEX.test(normalized)) {
      throw new BadRequestException(
        'Code entrepot invalide. Format attendu: 2-40 caracteres [A-Z0-9_-].',
      );
    }
    return normalized;
  }

  private resolveIdentifierType(params: {
    system: BusinessSystem;
    requestedType?: IdentifierType;
  }): IdentifierType {
    if (!this.supportsIdentifiers(params.system)) {
      throw new BadRequestException('Ce systeme ne gere pas les extensions.');
    }

    const systemIdentifierType = params.system.identifierType;
    const resolvedType = params.requestedType ?? systemIdentifierType;

    if (!resolvedType) {
      throw new BadRequestException('Impossible de determiner le type d identifiant.');
    }

    if (systemIdentifierType && resolvedType !== systemIdentifierType) {
      throw new BadRequestException(
        `Type incompatible. Ce systeme accepte uniquement ${systemIdentifierType}.`,
      );
    }

    return resolvedType;
  }

  private supportsIdentifiers(system: Pick<BusinessSystem, 'code' | 'hasIdentifiers'>): boolean {
    return system.code !== HardwareSystemCode.FEEDBACK && system.hasIdentifiers;
  }

  private async buildDeviceInventoryWhere(
    input: ListAdminInventoryInput,
  ): Promise<Prisma.DeviceWhereInput> {
    const where: Prisma.DeviceWhereInput = {};

    const systemId = input.systemId?.trim();
    const systemCode = input.systemCode;

    if (systemId) {
      where.systemId = systemId;
    } else if (systemCode) {
      const system = await this.businessSystemsService.getSystemByCodeOrThrow(systemCode, false);
      where.systemId = system.id;
    }

    if (input.status) {
      where.status = input.status;
    }

    if (input.warehouseCode?.trim()) {
      where.warehouseCode = this.normalizeWarehouseCode(input.warehouseCode);
    }

    const search = input.search?.trim();
    if (search) {
      where.OR = [
        {
          macAddress: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          id: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          identifiers: {
            some: {
              physicalIdentifier: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    return where;
  }
}
