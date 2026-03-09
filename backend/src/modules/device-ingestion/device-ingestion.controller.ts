import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TwoFactorAuthGuard } from '../../common/guards/two-factor-auth.guard';
import type { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import type { DeviceIngestionRequest } from './device-ingestion.types';
import { DeviceIngestionAuthGuard } from './device-ingestion-auth.guard';
import { IngestDeviceEventDto } from './dto/ingest-device-event.dto';
import { DeviceIngestionService } from './device-ingestion.service';

@Controller('device-ingestion')
export class DeviceIngestionController {
  constructor(private readonly deviceIngestionService: DeviceIngestionService) {}

  @Post('keys/:deviceId/rotate')
  @UseGuards(JwtAuthGuard, TwoFactorAuthGuard)
  rotateIngestionKey(@CurrentUser() user: AccessTokenPayload, @Param('deviceId') deviceId: string) {
    return this.deviceIngestionService.rotateIngestionKey(user.userId, deviceId);
  }

  @Post('events')
  @UseGuards(DeviceIngestionAuthGuard)
  ingestEvent(@Req() request: DeviceIngestionRequest, @Body() dto: IngestDeviceEventDto) {
    if (!request.deviceAuth) {
      throw new UnauthorizedException('Contexte boitier manquant.');
    }

    return this.deviceIngestionService.ingestEvent(request.deviceAuth, dto);
  }
}
