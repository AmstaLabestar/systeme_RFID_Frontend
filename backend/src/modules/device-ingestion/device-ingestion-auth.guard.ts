import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DeviceStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { hashToken } from '../../common/utils/security.util';
import { MetricsService } from '../observability/metrics.service';
import type { DeviceIngestionRequest } from './device-ingestion.types';

@Injectable()
export class DeviceIngestionAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DeviceIngestionRequest>();
    const token = this.readBearerToken(request.headers.authorization);
    const keyHash = hashToken(token);

    const ingestionKey = await this.prisma.deviceIngestionKey.findUnique({
      where: { keyHash },
      include: {
        device: {
          include: {
            system: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    if (!ingestionKey || ingestionKey.revokedAt) {
      this.metricsService.recordDeviceIngestionAuthFailure();
      throw new UnauthorizedException('Cle boitier invalide ou revoquee.');
    }

    const ownerId = ingestionKey.device.ownerId;
    if (!ownerId) {
      this.metricsService.recordDeviceIngestionAuthFailure();
      throw new UnauthorizedException('Boitier non attribue a un client.');
    }

    if (ingestionKey.device.status !== DeviceStatus.ASSIGNED) {
      this.metricsService.recordDeviceIngestionAuthFailure();
      throw new UnauthorizedException('Boitier non autorise pour l ingestion.');
    }

    if (!ingestionKey.device.isConfigured) {
      this.metricsService.recordDeviceIngestionAuthFailure();
      throw new BadRequestException('Boitier non configure.');
    }

    request.deviceAuth = {
      keyId: ingestionKey.id,
      ownerId,
      ownerTenantId: ingestionKey.device.ownerTenantId ?? undefined,
      deviceId: ingestionKey.device.id,
      systemCode: ingestionKey.device.system.code,
      macAddress: ingestionKey.device.macAddress,
    };

    return true;
  }

  private readBearerToken(headerValue: string | undefined): string {
    if (!headerValue) {
      this.metricsService.recordDeviceIngestionAuthFailure();
      throw new UnauthorizedException('Authorization bearer requis.');
    }

    const [scheme, credentials] = headerValue.trim().split(/\s+/, 2);
    if (!scheme || !credentials || scheme.toLowerCase() !== 'bearer') {
      this.metricsService.recordDeviceIngestionAuthFailure();
      throw new UnauthorizedException('Authorization bearer invalide.');
    }

    const token = credentials.trim();
    if (token.length < 24 || token.length > 256) {
      this.metricsService.recordDeviceIngestionAuthFailure();
      throw new UnauthorizedException('Cle boitier invalide.');
    }

    return token;
  }
}
