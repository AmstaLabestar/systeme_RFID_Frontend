import { Injectable } from '@nestjs/common';
import { Prisma, type BusinessSystem, type HardwareSystemCode } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class BusinessSystemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<BusinessSystem | null> {
    return this.prisma.businessSystem.findUnique({
      where: { id },
    });
  }

  findByCode(code: HardwareSystemCode): Promise<BusinessSystem | null> {
    return this.prisma.businessSystem.findUnique({
      where: { code },
    });
  }

  findMany(options?: { isActive?: boolean }): Promise<BusinessSystem[]> {
    const where: Prisma.BusinessSystemWhereInput =
      typeof options?.isActive === 'boolean' ? { isActive: options.isActive } : {};

    return this.prisma.businessSystem.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  create(data: Prisma.BusinessSystemCreateInput): Promise<BusinessSystem> {
    return this.prisma.businessSystem.create({ data });
  }

  updateById(id: string, data: Prisma.BusinessSystemUpdateInput): Promise<BusinessSystem> {
    return this.prisma.businessSystem.update({
      where: { id },
      data,
    });
  }
}
