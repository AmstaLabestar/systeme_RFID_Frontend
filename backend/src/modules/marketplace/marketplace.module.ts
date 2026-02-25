import { Module } from '@nestjs/common';
import { AllocationsModule } from '../allocations/allocations.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SystemsModule } from '../systems/systems.module';
import { MarketplaceOrdersController } from './marketplace-orders.controller';
import { MarketplaceOrdersService } from './marketplace-orders.service';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [SystemsModule, InventoryModule, AllocationsModule],
  controllers: [MarketplaceController, MarketplaceOrdersController],
  providers: [MarketplaceService, MarketplaceOrdersService],
  exports: [MarketplaceService, MarketplaceOrdersService],
})
export class MarketplaceModule {}
