import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsRepository } from './repositories/tenants.repository';

@Injectable()
export class TenantsService {
  constructor(private readonly tenantsRepository: TenantsRepository) {}

  async createTenant(dto: CreateTenantDto) {
    const existing = await this.tenantsRepository.findByDomain(dto.domain);
    if (existing) {
      throw new ConflictException('Tenant domain already exists.');
    }

    return this.tenantsRepository.create({
      name: dto.name,
      domain: dto.domain,
    });
  }

  async listTenants(query: PaginationQueryDto) {
    const { data, total } = await this.tenantsRepository.paginate(query.skip, query.limit);
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

  async getTenantById(id: string) {
    const tenant = await this.tenantsRepository.findById(id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }
    return tenant;
  }
}
