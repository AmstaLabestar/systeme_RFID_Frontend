import { Injectable } from '@nestjs/common';
import {
  DeviceStatus,
  IdentifierStatus,
  type Device,
  type Identifier,
  type Prisma,
} from '@prisma/client';
import { StockLedgerService } from './stock-ledger.service';

@Injectable()
export class InventoryLedgerFacade {
  constructor(private readonly stockLedgerService: StockLedgerService) {}

  async appendDeviceBatchCreation(params: {
    systemId: string;
    devices: Device[];
    identifiersByDeviceId: Map<string, Identifier[]>;
    actorId: string;
    tx: Prisma.TransactionClient;
  }): Promise<void> {
    const entries: Parameters<StockLedgerService['append']>[0] = [];

    params.devices.forEach((device) => {
      entries.push({
        resourceType: 'DEVICE',
        resourceId: device.id,
        systemId: params.systemId,
        deviceId: device.id,
        action: 'STOCK_CREATED',
        warehouseCode: device.warehouseCode,
        actorId: params.actorId,
        toStatus: DeviceStatus.IN_STOCK,
      });

      const identifiers = params.identifiersByDeviceId.get(device.id) ?? [];
      identifiers.forEach((identifier) => {
        entries.push({
          resourceType: 'IDENTIFIER',
          resourceId: identifier.id,
          systemId: params.systemId,
          deviceId: device.id,
          identifierId: identifier.id,
          action: 'STOCK_CREATED',
          warehouseCode: identifier.warehouseCode,
          actorId: params.actorId,
          toStatus: IdentifierStatus.IN_STOCK,
        });
      });
    });

    await this.stockLedgerService.append(entries, params.tx);
  }

  async appendDeviceExtensionCreation(params: {
    systemId: string;
    deviceId: string;
    identifiers: Identifier[];
    actorId: string;
    tx: Prisma.TransactionClient;
  }): Promise<void> {
    await this.stockLedgerService.append(
      params.identifiers.map((identifier) => ({
        resourceType: 'IDENTIFIER' as const,
        resourceId: identifier.id,
        systemId: params.systemId,
        deviceId: params.deviceId,
        identifierId: identifier.id,
        action: 'EXTENSION_STOCK_CREATED' as const,
        warehouseCode: identifier.warehouseCode,
        actorId: params.actorId,
        toStatus: IdentifierStatus.IN_STOCK,
      })),
      params.tx,
    );
  }

  async appendSystemExtensionCreation(params: {
    systemId: string;
    identifiers: Identifier[];
    actorId: string;
    tx: Prisma.TransactionClient;
  }): Promise<void> {
    await this.stockLedgerService.append(
      params.identifiers.map((identifier) => ({
        resourceType: 'IDENTIFIER' as const,
        resourceId: identifier.id,
        systemId: params.systemId,
        identifierId: identifier.id,
        action: 'EXTENSION_STOCK_CREATED' as const,
        warehouseCode: identifier.warehouseCode,
        actorId: params.actorId,
        toStatus: IdentifierStatus.IN_STOCK,
      })),
      params.tx,
    );
  }
}
