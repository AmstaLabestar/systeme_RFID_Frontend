import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { ConfigureDeviceDto } from './dto/configure-device.dto';
import { GetMyDevicesQueryDto } from './dto/get-my-devices-query.dto';
import { DevicesService } from './devices.service';

@Controller('devices')
@UseGuards(JwtAuthGuard, TwoFactorAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get('my')
  getMyDevices(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: GetMyDevicesQueryDto,
  ) {
    return this.devicesService.getMyDevices(user.userId, query);
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
