import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

interface CreateAdminAuditLogInput {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: unknown;
}

interface ListAdminAuditLogsInput {
  page: number;
  limit: number;
  action?: string;
  targetType?: string;
  actorId?: string;
}

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  createLog(input: CreateAdminAuditLogInput) {
    return this.prisma.adminActionLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        details:
          input.details === undefined ? undefined : (input.details as Prisma.InputJsonValue),
      },
    });
  }

  async listLogs(input: ListAdminAuditLogsInput) {
    const where: Prisma.AdminActionLogWhereInput = {
      ...(input.action ? { action: input.action } : {}),
      ...(input.targetType ? { targetType: input.targetType } : {}),
      ...(input.actorId ? { actorId: input.actorId } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.adminActionLog.count({ where }),
      this.prisma.adminActionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page: input.page,
      limit: input.limit,
      items,
    };
  }
}
