import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { OutboxModule } from '../outbox/outbox.module';
import { SystemsModule } from '../systems/systems.module';
import { AdminAuditService } from './admin-audit.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [SystemsModule, InventoryModule, OutboxModule],
  controllers: [AdminController],
  providers: [AdminAuditService],
})
export class AdminModule {}
