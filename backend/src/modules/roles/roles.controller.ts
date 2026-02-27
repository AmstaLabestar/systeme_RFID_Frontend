import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PERMISSIONS } from '../../common/permissions.constants';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { CreateRoleDto } from './dto/create-role.dto';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard, RolesGuard, PermissionsGuard)
@Roles('owner', 'admin')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Permissions(PERMISSIONS.roles.manage)
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(user, dto);
  }

  @Get()
  @Permissions(PERMISSIONS.roles.read)
  list(@CurrentUser() user: AccessTokenPayload, @Query() query: ListRolesQueryDto) {
    return this.rolesService.listRoles(user, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.roles.read)
  getById(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.rolesService.getRoleById(user, id);
  }
}
