import { HardwareSystemCode, OrderTargetType } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { MarketplaceOrdersController } from './marketplace-orders.controller';
import { MarketplaceOrdersService } from './marketplace-orders.service';

describe('MarketplaceOrdersController', () => {
  const marketplaceOrdersService = {
    getMarketplaceSystems: jest.fn(),
    createOrder: jest.fn(),
  };

  let controller: MarketplaceOrdersController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MarketplaceOrdersController],
      providers: [
        {
          provide: MarketplaceOrdersService,
          useValue: marketplaceOrdersService,
        },
      ],
    }).compile();

    controller = moduleRef.get(MarketplaceOrdersController);
  });

  it('returns marketplace systems', async () => {
    marketplaceOrdersService.getMarketplaceSystems.mockResolvedValueOnce([{ id: 'system-1' }]);

    await expect(controller.getMarketplaceSystems()).resolves.toEqual([{ id: 'system-1' }]);
  });

  it('creates an order for the current user', async () => {
    const user = { userId: 'user-1' };
    const dto = {
      systemCode: HardwareSystemCode.RFID_PRESENCE,
      targetType: OrderTargetType.DEVICE,
      quantity: 1,
    };
    marketplaceOrdersService.createOrder.mockResolvedValueOnce({ order: { id: 'order-1' } });

    await expect(controller.createOrder(user as any, dto, 'idem-12345678')).resolves.toEqual({
      order: { id: 'order-1' },
    });
    expect(marketplaceOrdersService.createOrder).toHaveBeenCalledWith(
      'user-1',
      dto,
      'idem-12345678',
    );
  });
});
