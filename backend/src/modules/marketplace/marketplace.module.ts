import { Module } from '@nestjs/common';
import { AllocationsModule } from '../allocations/allocations.module';
import { InventoryModule } from '../inventory/inventory.module';
import { MarketplaceOrdersController } from './marketplace-orders.controller';
import { MarketplaceOrdersService } from './marketplace-orders.service';

@Module({
  imports: [InventoryModule, AllocationsModule],
  controllers: [MarketplaceOrdersController],
  providers: [MarketplaceOrdersService],
  exports: [MarketplaceOrdersService],
})
export class MarketplaceModule {}
