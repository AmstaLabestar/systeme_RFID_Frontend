import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantsRepository } from './repositories/tenants.repository';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, TenantsRepository, RolesGuard, PermissionsGuard],
  exports: [TenantsService, TenantsRepository],
})
export class TenantsModule {}
