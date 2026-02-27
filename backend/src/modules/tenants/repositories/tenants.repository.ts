import { Injectable } from '@nestjs/common';
import { Prisma, Tenant } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class TenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.TenantCreateInput): Promise<Tenant> {
    return this.prisma.tenant.create({ data });
  }

  findById(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  findByDomain(domain: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { domain } });
  }

  async paginate(
    skip: number,
    take: number,
    tenantId?: string,
  ): Promise<{ data: Tenant[]; total: number }> {
    const where: Prisma.TenantWhereInput = tenantId ? { id: tenantId } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { data, total };
  }
}
