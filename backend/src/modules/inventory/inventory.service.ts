import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeviceStatus,
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

const MAC_ADDRESS_REGEX = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

interface DeviceSeedInput {
  macAddress: string;
  identifiers?: string[];
}

interface CreateDevicesInBulkInput {
  systemId: string;
  quantity: number;
  devices: DeviceSeedInput[];
  createdById: string;
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
}

export interface SystemStockOverview {
  id: string;
  name: string;
  code: BusinessSystem['code'];
  hasIdentifiers: boolean;
  identifiersPerDevice: number;
  identifierType: BusinessSystem['identifierType'];
  isActive: boolean;
  availableDevices: number;
  availableExtensions: number;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessSystemsService: BusinessSystemsService,
    private readonly identifiersService: IdentifiersService,
  ) {}

  async listSystemsWithStock(includeInactive = false): Promise<SystemStockOverview[]> {
    const systems = includeInactive
      ? await this.businessSystemsService.listAdminSystems()
      : await this.businessSystemsService.listActiveSystems();

    if (systems.length === 0) {
      return [];
    }

    const [deviceCounts, extensionCounts] = await Promise.all([
      Promise.all(
        systems.map((system) =>
          this.prisma.device.count({
            where: {
              systemId: system.id,
              status: DeviceStatus.IN_STOCK,
              ownerId: null,
            },
          }),
        ),
      ),
      Promise.all(
        systems.map((system) =>
          this.prisma.identifier.count({
            where: {
              systemId: system.id,
              status: IdentifierStatus.IN_STOCK,
              ownerId: null,
              deviceId: null,
            },
          }),
        ),
      ),
    ]);

    return systems.map((system, index) => ({
      id: system.id,
      name: system.name,
      code: system.code,
      hasIdentifiers: system.hasIdentifiers,
      identifiersPerDevice: system.identifiersPerDevice,
      identifierType: system.identifierType,
      isActive: system.isActive,
      availableDevices: deviceCounts[index] ?? 0,
      availableExtensions: extensionCounts[index] ?? 0,
    }));
  }

  async createDevicesInBulk(input: CreateDevicesInBulkInput): Promise<Device[]> {
    const system = await this.businessSystemsService.getSystemByIdOrThrow(input.systemId);

    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('quantity doit etre un entier strictement positif.');
    }

    if (!Array.isArray(input.devices) || input.devices.length !== input.quantity) {
      throw new BadRequestException(
        'Le nombre de boitiers detaille doit correspondre exactement a quantity.',
      );
    }

    const normalizedDevices = this.normalizeDeviceBatch(input.devices, system);

    if (system.hasIdentifiers && !system.identifierType) {
      throw new BadRequestException(
        'Configuration systeme invalide: identifierType manquant.',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const createdDevices: Device[] = [];

        for (const deviceInput of normalizedDevices) {
          // Stock is physically provisioned by admin before any marketplace purchase.
          const device = await tx.device.create({
            data: {
              systemId: system.id,
              macAddress: deviceInput.macAddress,
              status: DeviceStatus.IN_STOCK,
              createdById: input.createdById,
            },
          });
          createdDevices.push(device);

          if (system.hasIdentifiers) {
            await this.identifiersService.createIdentifiers(
              {
                systemId: system.id,
                deviceId: device.id,
                type: system.identifierType as IdentifierType,
                physicalIdentifiers: deviceInput.identifiers,
                createdById: input.createdById,
              },
              tx,
            );
          }
        }

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
      return await this.identifiersService.createIdentifiers({
        systemId: device.systemId,
        deviceId: device.id,
        type: resolvedType,
        physicalIdentifiers: input.physicalIdentifiers,
        createdById: input.createdById,
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

    try {
      return await this.identifiersService.createIdentifiers({
        systemId: system.id,
        type: resolvedType,
        physicalIdentifiers: input.physicalIdentifiers,
        createdById: input.createdById,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un identifiant physique existe deja.');
      }
      throw error;
    }
  }

  private normalizeDeviceBatch(
    devices: DeviceSeedInput[],
    system: BusinessSystem,
  ): Array<{ macAddress: string; identifiers: string[] }> {
    const normalizedMacs = new Set<string>();
    const normalizedPhysicalIdentifiers = new Set<string>();

    return devices.map((device, index) => {
      const macAddress = this.normalizeMacAddress(device.macAddress);

      if (normalizedMacs.has(macAddress)) {
        throw new BadRequestException(
          `Adresse MAC dupliquee dans la requete (position ${index + 1}).`,
        );
      }
      normalizedMacs.add(macAddress);

      if (!system.hasIdentifiers) {
        if (Array.isArray(device.identifiers) && device.identifiers.length > 0) {
          throw new BadRequestException(
            'Ce systeme ne supporte pas les identifiants materiels.',
          );
        }
        return {
          macAddress,
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

  private resolveIdentifierType(params: {
    system: BusinessSystem;
    requestedType?: IdentifierType;
  }): IdentifierType {
    if (!params.system.hasIdentifiers) {
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
}
