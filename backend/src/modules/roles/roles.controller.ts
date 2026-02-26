import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { CreateRoleDto } from './dto/create-role.dto';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AccessTokenPayload, @Query() query: ListRolesQueryDto) {
    return this.rolesService.listRoles(user, query);
  }

  @Get(':id')
  getById(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.rolesService.getRoleById(user, id);
  }
}
