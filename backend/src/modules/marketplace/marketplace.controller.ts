import { Body, Controller, Get, GoneException, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { ActivateDeviceDto } from './dto/activate-device.dto';
import { PurchaseProductDto } from './dto/purchase-product.dto';
import { MarketplaceService } from './marketplace.service';

@Controller('marketplace')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard)
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('catalog')
  getCatalog() {
    return this.marketplaceService.getCatalog();
  }

  @Get('state')
  getMarketplaceState(@CurrentUser() user: AccessTokenPayload) {
    return this.marketplaceService.getMarketplaceState(user.userId);
  }

  @Post('purchases')
  purchaseProduct(@CurrentUser() _user: AccessTokenPayload, @Body() _dto: PurchaseProductDto) {
    throw new GoneException(
      'Endpoint legacy deprecie. Utilisez POST /marketplace/orders (allocation-only).',
    );
  }

  @Post('devices/:deviceId/activate')
  activateDevice(
    @CurrentUser() user: AccessTokenPayload,
    @Param('deviceId') deviceId: string,
    @Body() dto: ActivateDeviceDto,
  ) {
    return this.marketplaceService.activateDevice(user.userId, deviceId, dto);
  }
}
