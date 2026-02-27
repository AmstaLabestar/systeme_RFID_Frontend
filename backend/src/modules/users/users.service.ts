import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { RolesRepository } from '../roles/repositories/roles.repository';
import { TenantsRepository } from '../tenants/repositories/tenants.repository';
import {
  type AuthUserRecord,
  type PublicUserRecord,
  UsersRepository,
} from './repositories/users.repository';
import { splitName } from '../../common/utils/security.util';

@Injectable()
export class UsersService {
  private readonly bcryptSaltRounds: number;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly tenantsRepository: TenantsRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly configService: ConfigService,
  ) {
    this.bcryptSaltRounds = this.configService.getOrThrow<number>('BCRYPT_SALT_ROUNDS');
  }

  async createUser(actor: AccessTokenPayload, dto: CreateUserDto) {
    if (dto.tenantId !== actor.tenantId) {
      throw new BadRequestException('Cross-tenant user creation is forbidden.');
    }

    const [existingByEmail, existingByPhone, tenant, role] = await Promise.all([
      this.usersRepository.findAuthByEmail(dto.email),
      dto.phoneNumber ? this.usersRepository.findAuthByPhoneNumber(dto.phoneNumber) : null,
      this.tenantsRepository.findById(dto.tenantId),
      this.rolesRepository.findById(dto.roleId),
    ]);

    if (existingByEmail) {
      throw new ConflictException('Email already exists.');
    }

    if (existingByPhone) {
      throw new ConflictException('Phone number already exists.');
    }

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    if (role.tenantId !== tenant.id) {
      throw new BadRequestException('Role does not belong to this tenant.');
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, this.bcryptSaltRounds)
      : null;

    const createdUser = await this.usersRepository.create({
      name: dto.name,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      passwordHash,
      role: { connect: { id: dto.roleId } },
      tenant: { connect: { id: dto.tenantId } },
    });

    return this.toUserResponse(createdUser);
  }

  async listUsers(actor: AccessTokenPayload, query: ListUsersQueryDto) {
    const { data, total } = await this.usersRepository.paginate(
      query.skip,
      query.limit,
      actor.tenantId,
    );

    return {
      data: data.map((entry) => this.toUserResponse(entry)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getUserById(actor: AccessTokenPayload, id: string) {
    const user = await this.usersRepository.findPublicById(id);
    if (!user || user.tenant.id !== actor.tenantId) {
      throw new NotFoundException('User not found.');
    }
    return this.toUserResponse(user);
  }

  toUserResponse(user: PublicUserRecord | AuthUserRecord) {
    const { firstName, lastName } = splitName(user.name);
    return {
      id: user.id,
      name: user.name,
      firstName,
      lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      googleId: user.googleId,
      provider: user.provider,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
      company: user.tenant.name,
      tenant: user.tenant,
      role: {
        id: user.role.id,
        name: user.role.name,
        permissions: user.role.permissions,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
