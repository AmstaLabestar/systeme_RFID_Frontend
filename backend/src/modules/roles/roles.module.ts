import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantsModule } from '../tenants/tenants.module';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { RolesRepository } from './repositories/roles.repository';

@Module({
  imports: [TenantsModule],
  controllers: [RolesController],
  providers: [RolesService, RolesRepository, RolesGuard],
  exports: [RolesService, RolesRepository],
})
export class RolesModule {}
