import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeviceStatus,
  Prisma,
  type Device,
  type Identifier,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { IdentifiersService } from '../identifiers/identifiers.service';
import { BusinessSystemsService } from '../systems/business-systems.service';
import {
  type AddIdentifiersToDeviceInput,
  type AddIdentifiersToSystemInput,
  type CreateDevicesInBulkInput,
} from './inventory.types';
import { InventoryLedgerFacade } from './inventory-ledger-facade.service';
import { InventoryValidationService } from './inventory-validation.service';

@Injectable()
export class InventoryCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessSystemsService: BusinessSystemsService,
    private readonly identifiersService: IdentifiersService,
    private readonly inventoryValidationService: InventoryValidationService,
    private readonly inventoryLedgerFacade: InventoryLedgerFacade,
  ) {}

  async createDevicesInBulk(input: CreateDevicesInBulkInput): Promise<Device[]> {
    const system = await this.businessSystemsService.getSystemByIdOrThrow(input.systemId);
    const supportsIdentifiers = this.inventoryValidationService.supportsIdentifiers(system);

    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('quantity doit etre un entier strictement positif.');
    }

    if (!Array.isArray(input.devices) || input.devices.length !== input.quantity) {
      throw new BadRequestException(
        'Le nombre de boitiers detaille doit correspondre exactement a quantity.',
      );
    }

    const normalizedDevices = this.inventoryValidationService.normalizeDeviceBatch(
      input.devices,
      system,
      input.warehouseCode,
    );

    if (supportsIdentifiers && !system.identifierType) {
      throw new BadRequestException('Configuration systeme invalide: identifierType manquant.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const createdDevices: Device[] = [];
        const identifiersByDeviceId = new Map<string, Identifier[]>();

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

          if (supportsIdentifiers) {
            const createdIdentifiers = await this.identifiersService.createIdentifiers(
              {
                systemId: system.id,
                deviceId: device.id,
                type: system.identifierType!,
                physicalIdentifiers: deviceInput.identifiers,
                warehouseCode: device.warehouseCode,
                createdById: input.createdById,
              },
              tx,
            );
            identifiersByDeviceId.set(device.id, createdIdentifiers);
          }
        }

        await this.inventoryLedgerFacade.appendDeviceBatchCreation({
          systemId: system.id,
          devices: createdDevices,
          identifiersByDeviceId,
          actorId: input.createdById,
          tx,
        });

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

    const resolvedType = this.inventoryValidationService.resolveIdentifierType({
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

        await this.inventoryLedgerFacade.appendDeviceExtensionCreation({
          systemId: device.systemId,
          deviceId: device.id,
          identifiers: createdIdentifiers,
          actorId: input.createdById,
          tx,
        });

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
    const resolvedType = this.inventoryValidationService.resolveIdentifierType({
      system,
      requestedType: input.type,
    });
    const warehouseCode = this.inventoryValidationService.normalizeWarehouseCode(
      input.warehouseCode ?? 'MAIN',
    );

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

        await this.inventoryLedgerFacade.appendSystemExtensionCreation({
          systemId: system.id,
          identifiers: createdIdentifiers,
          actorId: input.createdById,
          tx,
        });

        return createdIdentifiers;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un identifiant physique existe deja.');
      }
      throw error;
    }
  }
}
