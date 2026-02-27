import { Module } from '@nestjs/common';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantsModule } from '../tenants/tenants.module';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { RolesRepository } from './repositories/roles.repository';

@Module({
  imports: [TenantsModule],
  controllers: [RolesController],
  providers: [RolesService, RolesRepository, RolesGuard, PermissionsGuard],
  exports: [RolesService, RolesRepository],
})
export class RolesModule {}
