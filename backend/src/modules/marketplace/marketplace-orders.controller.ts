import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { CreateMarketplaceOrderDto } from './dto/create-marketplace-order.dto';
import { MarketplaceOrdersService } from './marketplace-orders.service';

@Controller('marketplace')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard)
export class MarketplaceOrdersController {
  constructor(private readonly marketplaceOrdersService: MarketplaceOrdersService) {}

  @Get('systems')
  getMarketplaceSystems() {
    return this.marketplaceOrdersService.getMarketplaceSystems();
  }

  @Post('orders')
  createOrder(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateMarketplaceOrderDto) {
    return this.marketplaceOrdersService.createOrder(user.userId, dto);
  }
}
