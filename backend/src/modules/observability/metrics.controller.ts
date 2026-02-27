import { Controller, Get, Header, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(): string {
    const metricsEnabled = this.configService.get<boolean>('METRICS_ENABLED') ?? false;
    if (!metricsEnabled) {
      throw new NotFoundException();
    }

    return this.metricsService.renderPrometheus();
  }
}
