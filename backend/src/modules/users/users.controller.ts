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
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard, RolesGuard, PermissionsGuard)
@Roles('owner', 'admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions(PERMISSIONS.users.manage)
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateUserDto) {
    return this.usersService.createUser(user, dto);
  }

  @Get()
  @Permissions(PERMISSIONS.users.read)
  list(@CurrentUser() user: AccessTokenPayload, @Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers(user, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.users.read)
  getById(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.usersService.getUserById(user, id);
  }
}
