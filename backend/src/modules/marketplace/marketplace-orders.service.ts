import { Injectable } from '@nestjs/common';
import { AllocationsService } from '../allocations/allocations.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateMarketplaceOrderDto } from './dto/create-marketplace-order.dto';

@Injectable()
export class MarketplaceOrdersService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly allocationsService: AllocationsService,
  ) {}

  getMarketplaceSystems() {
    return this.inventoryService.listSystemsWithStock(false);
  }

  createOrder(userId: string, dto: CreateMarketplaceOrderDto) {
    return this.allocationsService.allocateOrder({
      customerId: userId,
      systemCode: dto.systemCode,
      targetType: dto.targetType,
      quantity: dto.quantity,
    });
  }
}
