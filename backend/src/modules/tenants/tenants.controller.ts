import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PERMISSIONS } from '../../common/permissions.constants';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard, RolesGuard, PermissionsGuard)
@Roles('owner', 'admin')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @Permissions(PERMISSIONS.tenants.manage)
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateTenantDto) {
    return this.tenantsService.createTenant(user, dto);
  }

  @Get()
  @Permissions(PERMISSIONS.tenants.read)
  list(@CurrentUser() user: AccessTokenPayload, @Query() query: PaginationQueryDto) {
    return this.tenantsService.listTenants(user, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.tenants.read)
  getById(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.tenantsService.getTenantById(user, id);
  }
}
