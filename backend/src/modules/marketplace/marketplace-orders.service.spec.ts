import { BadRequestException } from '@nestjs/common';
import { HardwareSystemCode, OrderTargetType } from '@prisma/client';
import { MarketplaceOrdersService } from './marketplace-orders.service';

describe('MarketplaceOrdersService', () => {
  const inventoryService = {
    listSystemsWithStock: jest.fn(),
  };

  const allocationsService = {
    allocateOrder: jest.fn(),
  };

  let service: MarketplaceOrdersService;

  beforeEach(() => {
    service = new MarketplaceOrdersService(inventoryService as any, allocationsService as any);
  });

  it('returns marketplace systems without inactive ones', async () => {
    inventoryService.listSystemsWithStock.mockResolvedValueOnce([{ id: 'system-1' }]);

    await expect(service.getMarketplaceSystems()).resolves.toEqual([{ id: 'system-1' }]);
    expect(inventoryService.listSystemsWithStock).toHaveBeenCalledWith(false);
  });

  it('rejects orders without an idempotency key', () => {
    expect(() =>
      service.createOrder(
        'user-1',
        {
          systemCode: HardwareSystemCode.RFID_PRESENCE,
          targetType: OrderTargetType.DEVICE,
          quantity: 1,
        },
        '   ',
      ),
    ).toThrow(BadRequestException);
  });

  it('delegates order allocation with the normalized payload', async () => {
    allocationsService.allocateOrder.mockResolvedValueOnce({ order: { id: 'order-1' } });

    const dto = {
      systemCode: HardwareSystemCode.RFID_PRESENCE,
      targetType: OrderTargetType.DEVICE,
      quantity: 2,
    };

    await expect(service.createOrder('user-1', dto, 'idem-12345678')).resolves.toEqual({
      order: { id: 'order-1' },
    });
    expect(allocationsService.allocateOrder).toHaveBeenCalledWith({
      customerId: 'user-1',
      systemCode: dto.systemCode,
      targetType: dto.targetType,
      quantity: dto.quantity,
      idempotencyKey: 'idem-12345678',
    });
  });
});
