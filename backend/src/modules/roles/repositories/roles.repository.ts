import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.RoleCreateInput): Promise<Role> {
    return this.prisma.role.create({ data });
  }

  findById(id: string): Promise<Role | null> {
    return this.prisma.role.findUnique({ where: { id } });
  }

  findByNameInTenant(tenantId: string, name: string): Promise<Role | null> {
    return this.prisma.role.findUnique({
      where: {
        tenantId_name: {
          tenantId,
          name,
        },
      },
    });
  }

  async paginate(
    skip: number,
    take: number,
    tenantId?: string,
  ): Promise<{ data: Role[]; total: number }> {
    const where: Prisma.RoleWhereInput = tenantId ? { tenantId } : {};

    const [data, total] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.role.count({ where }),
    ]);

    return { data, total };
  }
}
