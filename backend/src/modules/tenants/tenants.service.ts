import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsRepository } from './repositories/tenants.repository';

@Injectable()
export class TenantsService {
  constructor(private readonly tenantsRepository: TenantsRepository) {}

  async createTenant(_actor: AccessTokenPayload, _dto: CreateTenantDto) {
    throw new ForbiddenException(
      'Tenant provisioning is restricted to platform operators.',
    );
  }

  async listTenants(actor: AccessTokenPayload, query: PaginationQueryDto) {
    const { data, total } = await this.tenantsRepository.paginate(
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

  async getTenantById(actor: AccessTokenPayload, id: string) {
    if (id !== actor.tenantId) {
      throw new NotFoundException('Tenant not found.');
    }

    const tenant = await this.tenantsRepository.findById(id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }
    return tenant;
  }
}
