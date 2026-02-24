import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { SystemsModule } from '../systems/systems.module';
import { AllocationsService } from './allocations.service';

@Module({
  imports: [SystemsModule, OrdersModule],
  providers: [AllocationsService],
  exports: [AllocationsService],
})
export class AllocationsModule {}
