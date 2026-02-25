import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { OutboxModule } from '../outbox/outbox.module';
import { OrdersModule } from '../orders/orders.module';
import { SystemsModule } from '../systems/systems.module';
import { AllocationsService } from './allocations.service';

@Module({
  imports: [SystemsModule, OrdersModule, InventoryModule, OutboxModule],
  providers: [AllocationsService],
  exports: [AllocationsService],
})
export class AllocationsModule {}
