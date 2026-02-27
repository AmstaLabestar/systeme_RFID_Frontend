import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from '../../modules/observability/metrics.service';
import type { RequestWithCorrelationId } from './correlation-id.middleware';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const shouldLog = process.env.NODE_ENV !== 'test';

    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const requestWithCorrelationId = req as RequestWithCorrelationId;
      const path = req.originalUrl || req.url;

      this.metricsService.recordHttpRequest({
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: elapsedMs,
      });

      if (shouldLog) {
        this.logger.log(
          `${req.method} ${path} -> ${res.statusCode} (${elapsedMs.toFixed(1)}ms) [${requestWithCorrelationId.requestId ?? 'n/a'}]`,
        );
      }
    });

    next();
  }
}
