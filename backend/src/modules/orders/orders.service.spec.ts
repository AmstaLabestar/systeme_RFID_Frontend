import { OrderStatus, OrderTargetType } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const prisma = {
    order: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  let service: OrdersService;

  beforeEach(() => {
    service = new OrdersService(prisma as any);
  });

  it('creates an order with CREATED status', async () => {
    prisma.order.create.mockResolvedValueOnce({ id: 'order-1' });

    await expect(
      service.createOrder({
        customerId: 'customer-1',
        tenantId: 'tenant-1',
        systemId: 'system-1',
        targetType: OrderTargetType.DEVICE,
        quantity: 2,
        idempotencyKey: 'idem-12345678',
        unitPriceCents: 21000,
        currency: 'XOF',
      }),
    ).resolves.toEqual({ id: 'order-1' });
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: {
        customerId: 'customer-1',
        tenantId: 'tenant-1',
        systemId: 'system-1',
        targetType: OrderTargetType.DEVICE,
        quantity: 2,
        idempotencyKey: 'idem-12345678',
        unitPriceCents: 21000,
        currency: 'XOF',
        status: OrderStatus.CREATED,
      },
    });
  });

  it('finds an order by customer and idempotency key with the allocation graph', async () => {
    prisma.order.findFirst.mockResolvedValueOnce({ id: 'order-1' });

    await expect(service.findByCustomerAndIdempotencyKey('customer-1', 'idem-12345678')).resolves.toEqual(
      { id: 'order-1' },
    );
    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: {
        customerId: 'customer-1',
        idempotencyKey: 'idem-12345678',
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
  });

  it('marks orders as completed or failed', async () => {
    prisma.order.update
      .mockResolvedValueOnce({ id: 'order-1', status: OrderStatus.COMPLETED })
      .mockResolvedValueOnce({
        id: 'order-1',
        status: OrderStatus.FAILED,
        failureReason: 'Insufficient stock',
      });

    await expect(service.markCompleted('order-1')).resolves.toEqual({
      id: 'order-1',
      status: OrderStatus.COMPLETED,
    });
    await expect(service.markFailed('order-1', 'Insufficient stock')).resolves.toEqual({
      id: 'order-1',
      status: OrderStatus.FAILED,
      failureReason: 'Insufficient stock',
    });
  });
});
