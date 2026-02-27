import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  health() {
    return {
      status: 'ok',
      service: 'rfid-backend',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  liveness() {
    return {
      status: 'live',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async readiness() {
    const startedAt = process.hrtime.bigint();

    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      return {
        status: 'ready',
        checks: {
          database: 'up',
          latencyMs: Number(latencyMs.toFixed(2)),
        },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not-ready',
        checks: {
          database: 'down',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
