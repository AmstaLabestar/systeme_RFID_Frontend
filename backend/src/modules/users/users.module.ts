import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RolesModule } from '../roles/roles.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './repositories/users.repository';

@Module({
  imports: [RolesModule, TenantsModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, RolesGuard],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
