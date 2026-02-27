import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { InventoryModule } from '../inventory/inventory.module';
import { OutboxModule } from '../outbox/outbox.module';
import { SystemsModule } from '../systems/systems.module';
import { AdminAuditService } from './admin-audit.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [SystemsModule, InventoryModule, OutboxModule],
  controllers: [AdminController],
  providers: [AdminAuditService, RolesGuard, PermissionsGuard],
})
export class AdminModule {}
