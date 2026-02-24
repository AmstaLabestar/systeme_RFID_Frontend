import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.createTenant(dto);
  }

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.tenantsService.listTenants(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.tenantsService.getTenantById(id);
  }
}
