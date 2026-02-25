import { Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

export interface StockLedgerEntryInput {
  resourceType: 'DEVICE' | 'IDENTIFIER';
  resourceId: string;
  systemId: string;
  deviceId?: string | null;
  identifierId?: string | null;
  orderId?: string | null;
  action:
    | 'STOCK_CREATED'
    | 'EXTENSION_STOCK_CREATED'
    | 'RESERVED'
    | 'ASSIGNED'
    | 'RELEASED'
    | 'CONFIGURED';
  quantity?: number;
  warehouseCode?: string | null;
  actorId?: string | null;
  ownerId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  details?: Prisma.InputJsonValue;
}

@Injectable()
export class StockLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async append(entries: StockLedgerEntryInput[], tx?: Prisma.TransactionClient): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const client: PrismaClientLike = tx ?? this.prisma;
    await client.stockMovement.createMany({
      data: entries.map((entry) => ({
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        systemId: entry.systemId,
        deviceId: entry.deviceId ?? null,
        identifierId: entry.identifierId ?? null,
        orderId: entry.orderId ?? null,
        action: entry.action,
        quantity: entry.quantity ?? 1,
        warehouseCode: entry.warehouseCode ?? null,
        actorId: entry.actorId ?? null,
        ownerId: entry.ownerId ?? null,
        fromStatus: entry.fromStatus ?? null,
        toStatus: entry.toStatus ?? null,
        details: entry.details ?? undefined,
      })),
    });
  }

  listMovements(
    params: {
      page: number;
      limit: number;
      systemId?: string;
      resourceType?: 'DEVICE' | 'IDENTIFIER';
      action?: StockLedgerEntryInput['action'];
      warehouseCode?: string;
      search?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client: PrismaClientLike = tx ?? this.prisma;
    const where: Prisma.StockMovementWhereInput = {
      ...(params.systemId ? { systemId: params.systemId } : {}),
      ...(params.resourceType ? { resourceType: params.resourceType } : {}),
      ...(params.action ? { action: params.action } : {}),
      ...(params.warehouseCode ? { warehouseCode: params.warehouseCode } : {}),
    };

    if (params.search) {
      where.OR = [
        {
          resourceId: {
            contains: params.search,
            mode: 'insensitive',
          },
        },
        {
          device: {
            macAddress: {
              contains: params.search,
              mode: 'insensitive',
            },
          },
        },
        {
          identifier: {
            physicalIdentifier: {
              contains: params.search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    return Promise.all([
      client.stockMovement.count({ where }),
      client.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          system: true,
          device: {
            select: {
              id: true,
              macAddress: true,
            },
          },
          identifier: {
            select: {
              id: true,
              physicalIdentifier: true,
            },
          },
          order: {
            select: {
              id: true,
              customerId: true,
            },
          },
        },
      }),
    ]).then(([total, items]) => ({
      total,
      page: params.page,
      limit: params.limit,
      items,
    }));
  }
}
