import { Injectable } from '@nestjs/common';
import { OrderStatus, type OrderTargetType, type Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

interface CreateOrderInput {
  customerId: string;
  tenantId: string;
  systemId: string;
  targetType: OrderTargetType;
  quantity: number;
  idempotencyKey?: string | null;
  unitPriceCents?: number | null;
  currency?: string | null;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  createOrder(input: CreateOrderInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.order.create({
      data: {
        customerId: input.customerId,
        tenantId: input.tenantId,
        systemId: input.systemId,
        targetType: input.targetType,
        quantity: input.quantity,
        idempotencyKey: input.idempotencyKey ?? null,
        unitPriceCents: input.unitPriceCents ?? null,
        currency: input.currency ?? null,
        status: OrderStatus.CREATED,
      },
    });
  }

  findByCustomerAndIdempotencyKey(
    customerId: string,
    idempotencyKey: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    return client.order.findFirst({
      where: {
        customerId,
        idempotencyKey,
      },
      include: {
        system: true,
        allocations: {
          include: {
            device: {
              include: {
                system: true,
                identifiers: {
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
            identifier: {
              include: {
                system: true,
              },
            },
          },
        },
      },
    });
  }

  markCompleted(orderId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.COMPLETED,
      },
    });
  }

  markFailed(orderId: string, failureReason: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.FAILED,
        failureReason,
      },
    });
  }

  findOrderById(orderId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.order.findUnique({
      where: { id: orderId },
      include: {
        system: true,
        allocations: true,
      },
    });
  }
}
