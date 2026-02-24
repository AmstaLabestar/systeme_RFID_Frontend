import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { UpdateMarketplaceStateDto } from './dto/update-marketplace-state.dto';
import { UpdateServicesStateDto } from './dto/update-services-state.dto';
import { SystemsStateService } from './systems-state.service';

@Controller('systems')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard)
export class SystemsController {
  constructor(private readonly systemsStateService: SystemsStateService) {}

  @Get('state')
  getState(@CurrentUser() user: AccessTokenPayload) {
    return this.systemsStateService.getSystemsState(user.userId);
  }

  @Get('marketplace-state')
  getMarketplaceState(@CurrentUser() user: AccessTokenPayload) {
    return this.systemsStateService.getMarketplaceState(user.userId);
  }

  @Put('marketplace-state')
  updateMarketplaceState(
    @CurrentUser() user: AccessTokenPayload,
    @Body() payload: UpdateMarketplaceStateDto,
  ) {
    return this.systemsStateService.saveMarketplaceState(user.userId, payload);
  }

  @Get('services-state')
  getServicesState(@CurrentUser() user: AccessTokenPayload) {
    return this.systemsStateService.getServicesState(user.userId);
  }

  @Put('services-state')
  updateServicesState(@CurrentUser() user: AccessTokenPayload, @Body() payload: UpdateServicesStateDto) {
    return this.systemsStateService.saveServicesState(user.userId, payload);
  }
}
