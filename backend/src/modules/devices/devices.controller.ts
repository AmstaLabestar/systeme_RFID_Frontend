import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { ConfigureDeviceDto } from './dto/configure-device.dto';
import { DevicesService } from './devices.service';

@Controller('devices')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get('my')
  getMyDevices(@CurrentUser() user: AccessTokenPayload) {
    return this.devicesService.getMyDevices(user.userId);
  }

  @Patch(':deviceId/configure')
  configureDevice(
    @CurrentUser() user: AccessTokenPayload,
    @Param('deviceId') deviceId: string,
    @Body() dto: ConfigureDeviceDto,
  ) {
    return this.devicesService.configureMyDevice(user.userId, deviceId, dto);
  }
}
