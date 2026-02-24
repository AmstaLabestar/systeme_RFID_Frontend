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
}
