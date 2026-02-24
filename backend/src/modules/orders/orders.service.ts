import { Injectable } from '@nestjs/common';
import { OrderStatus, type OrderTargetType, type Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

interface CreateOrderInput {
  customerId: string;
  tenantId: string;
  systemId: string;
  targetType: OrderTargetType;
  quantity: number;
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
        unitPriceCents: input.unitPriceCents ?? null,
        currency: input.currency ?? null,
        status: OrderStatus.CREATED,
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
