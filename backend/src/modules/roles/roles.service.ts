import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { CreateRoleDto } from './dto/create-role.dto';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import { RolesRepository } from './repositories/roles.repository';
import { TenantsRepository } from '../tenants/repositories/tenants.repository';

@Injectable()
export class RolesService {
  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly tenantsRepository: TenantsRepository,
  ) {}

  async createRole(actor: AccessTokenPayload, dto: CreateRoleDto) {
    if (dto.tenantId !== actor.tenantId) {
      throw new ConflictException('Cross-tenant role creation is forbidden.');
    }

    const tenant = await this.tenantsRepository.findById(dto.tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    const existing = await this.rolesRepository.findByNameInTenant(dto.tenantId, dto.name);
    if (existing) {
      throw new ConflictException('Role already exists in this tenant.');
    }

    return this.rolesRepository.create({
      name: dto.name,
      permissions: dto.permissions,
      tenant: {
        connect: { id: dto.tenantId },
      },
    });
  }

  async listRoles(actor: AccessTokenPayload, query: ListRolesQueryDto) {
    const { data, total } = await this.rolesRepository.paginate(
      query.skip,
      query.limit,
      actor.tenantId,
    );

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getRoleById(actor: AccessTokenPayload, id: string) {
    const role = await this.rolesRepository.findById(id);
    if (!role || role.tenantId !== actor.tenantId) {
      throw new NotFoundException('Role not found.');
    }
    return role;
  }
}
