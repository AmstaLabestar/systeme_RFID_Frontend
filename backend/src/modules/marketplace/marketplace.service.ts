import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CATALOG_BY_ID,
  MARKETPLACE_CATALOG,
} from '../systems/domain/system-state.constants';
import {
  buildDeviceName,
  buildGenerationCounters,
  createId,
  createUniqueQrFeedbackToken,
  isValidSystemIdentifier,
  normalizeSystemIdentifier,
} from '../systems/domain/system-state.utils';
import type { DeviceUnit, InventoryIdentifier } from '../systems/domain/system-state.types';
import { SystemsStateService } from '../systems/systems-state.service';
import { ActivateDeviceDto } from './dto/activate-device.dto';
import { PurchaseProductDto } from './dto/purchase-product.dto';

@Injectable()
export class MarketplaceService {
  constructor(private readonly systemsStateService: SystemsStateService) {}

  getCatalog() {
    return MARKETPLACE_CATALOG;
  }

  getMarketplaceState(userId: string) {
    return this.systemsStateService.getMarketplaceState(userId);
  }

  async purchaseProduct(userId: string, dto: PurchaseProductDto) {
    const product = CATALOG_BY_ID.get(dto.productId);

    if (!product) {
      throw new NotFoundException('Produit introuvable.');
    }

    if (!Number.isInteger(dto.quantity) || dto.quantity < 1) {
      throw new BadRequestException('La quantite doit etre superieure a 0.');
    }

    const marketplaceState = await this.systemsStateService.getMarketplaceState(userId);
    const remainingStock = marketplaceState.productStockById[product.id] ?? null;

    if (remainingStock !== null && dto.quantity > remainingStock) {
      throw new BadRequestException('Stock materiel insuffisant pour ce boitier.');
    }

    const counters = buildGenerationCounters(marketplaceState);
    const feedbackTokens = await this.systemsStateService.collectFeedbackQrTokens();
    const createdAt = new Date().toISOString();
    const createdDevices: DeviceUnit[] = [];
    const createdIdentifiers: InventoryIdentifier[] = [];

    if (product.kind === 'device') {
      for (let index = 0; index < dto.quantity; index += 1) {
        const deviceIndex = counters.nextDeviceIndex(product.module);
        const deviceId = createId('device');
        const createdDevice: DeviceUnit = {
          id: deviceId,
          module: product.module,
          name: buildDeviceName(product.module, deviceIndex),
          location: 'A configurer',
          provisionedMacAddress: counters.nextProvisionedMacAddress(product.module),
          configured: false,
          capacity: product.includedIdentifiers ?? 0,
          createdAt,
        };

        if (product.module === 'feedback') {
          createdDevice.qrToken = createUniqueQrFeedbackToken(feedbackTokens);
        }

        createdDevices.push(createdDevice);

        if (product.identifierType && (product.includedIdentifiers ?? 0) > 0) {
          for (let codeIndex = 0; codeIndex < (product.includedIdentifiers ?? 0); codeIndex += 1) {
            createdIdentifiers.push({
              id: createId('idn'),
              module: product.module,
              type: product.identifierType,
              code: counters.nextIdentifierCode(product.identifierType),
              status: 'available',
              deviceId,
              acquiredAt: createdAt,
            });
          }
        }
      }
    }

    if (product.kind === 'identifier-pack' && product.identifierType && product.quantityPerPack) {
      const count = dto.quantity * product.quantityPerPack;

      for (let index = 0; index < count; index += 1) {
        createdIdentifiers.push({
          id: createId('idn'),
          module: product.module,
          type: product.identifierType,
          code: counters.nextIdentifierCode(product.identifierType),
          status: 'available',
          acquiredAt: createdAt,
        });
      }
    }

    if (remainingStock !== null) {
      marketplaceState.productStockById[product.id] = Math.max(remainingStock - dto.quantity, 0);
    }

    marketplaceState.devices = [...marketplaceState.devices, ...createdDevices];
    marketplaceState.inventory = [...marketplaceState.inventory, ...createdIdentifiers];

    const savedMarketplaceState = await this.systemsStateService.saveMarketplaceState(
      userId,
      marketplaceState,
    );

    return {
      purchaseId: createId('purchase'),
      createdDevices,
      createdIdentifiers,
      redirectModule: product.module,
      marketplaceState: savedMarketplaceState,
    };
  }

  async activateDevice(userId: string, deviceId: string, dto: ActivateDeviceDto) {
    if (!deviceId.trim()) {
      throw new BadRequestException('Payload activation incomplet.');
    }

    const normalizedSystemIdentifier = normalizeSystemIdentifier(dto.systemIdentifier);
    if (!isValidSystemIdentifier(normalizedSystemIdentifier)) {
      throw new BadRequestException('Identifiant systeme invalide. Utilisez une adresse MAC valide.');
    }

    const marketplaceState = await this.systemsStateService.getMarketplaceState(userId);
    const targetDevice = marketplaceState.devices.find((device) => device.id === deviceId);

    if (!targetDevice) {
      throw new NotFoundException('Boitier introuvable.');
    }

    if (normalizeSystemIdentifier(targetDevice.provisionedMacAddress) !== normalizedSystemIdentifier) {
      throw new BadRequestException(
        'La MAC fournie ne correspond pas a la MAC livree pour ce boitier.',
      );
    }

    const alreadyUsed = marketplaceState.devices.some(
      (device) =>
        device.id !== targetDevice.id &&
        typeof device.systemIdentifier === 'string' &&
        normalizeSystemIdentifier(device.systemIdentifier) === normalizedSystemIdentifier,
    );

    if (alreadyUsed) {
      throw new BadRequestException('Cet identifiant systeme est deja lie a un autre boitier.');
    }

    targetDevice.configured = true;
    targetDevice.name = dto.name.trim();
    targetDevice.location = dto.location.trim();
    targetDevice.systemIdentifier = normalizedSystemIdentifier;
    targetDevice.activatedAt = new Date().toISOString();

    const savedMarketplaceState = await this.systemsStateService.saveMarketplaceState(
      userId,
      marketplaceState,
    );
    const savedDevice = savedMarketplaceState.devices.find((device) => device.id === deviceId) ?? targetDevice;

    return {
      device: savedDevice,
      marketplaceState: savedMarketplaceState,
    };
  }
}
