import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }
}
