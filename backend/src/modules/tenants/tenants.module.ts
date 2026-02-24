import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantsRepository } from './repositories/tenants.repository';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, TenantsRepository, RolesGuard],
  exports: [TenantsService, TenantsRepository],
})
export class TenantsModule {}
