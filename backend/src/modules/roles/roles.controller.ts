import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(dto);
  }

  @Get()
  list(@Query() query: ListRolesQueryDto) {
    return this.rolesService.listRoles(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.rolesService.getRoleById(id);
  }
}
