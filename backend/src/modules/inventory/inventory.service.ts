import { Injectable } from '@nestjs/common';
import { type Device, type Identifier } from '@prisma/client';
import { InventoryCommandService } from './inventory-command.service';
import { InventoryQueryService } from './inventory-query.service';
import type {
  AddIdentifiersToDeviceInput,
  AddIdentifiersToSystemInput,
  CreateDevicesInBulkInput,
  ListAdminInventoryInput,
  SystemStockOverview,
  ValidateDeviceImportBatchInput,
} from './inventory.types';
import { InventoryValidationService } from './inventory-validation.service';

export type {
  DeviceImportValidationIssue,
  DeviceImportValidationRow,
  ListAdminInventoryInput,
  SystemStockOverview,
} from './inventory.types';

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryQueryService: InventoryQueryService,
    private readonly inventoryCommandService: InventoryCommandService,
    private readonly inventoryValidationService: InventoryValidationService,
  ) {}

  listSystemsWithStock(includeInactive = false): Promise<SystemStockOverview[]> {
    return this.inventoryQueryService.listSystemsWithStock(includeInactive);
  }

  createDevicesInBulk(input: CreateDevicesInBulkInput): Promise<Device[]> {
    return this.inventoryCommandService.createDevicesInBulk(input);
  }

  validateDeviceImportBatch(input: ValidateDeviceImportBatchInput) {
    return this.inventoryValidationService.validateDeviceImportBatch(input);
  }

  addIdentifiersToDevice(input: AddIdentifiersToDeviceInput): Promise<Identifier[]> {
    return this.inventoryCommandService.addIdentifiersToDevice(input);
  }

  addIdentifiersToSystemStock(input: AddIdentifiersToSystemInput): Promise<Identifier[]> {
    return this.inventoryCommandService.addIdentifiersToSystemStock(input);
  }

  listDeviceInventory(input: ListAdminInventoryInput) {
    return this.inventoryQueryService.listDeviceInventory(input);
  }

  getDeviceInventoryDetail(deviceId: string) {
    return this.inventoryQueryService.getDeviceInventoryDetail(deviceId);
  }

  listLowStockAlerts() {
    return this.inventoryQueryService.listLowStockAlerts();
  }
}
