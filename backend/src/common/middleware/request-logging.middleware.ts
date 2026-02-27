import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { RequestWithCorrelationId } from './correlation-id.middleware';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    if (process.env.NODE_ENV === 'test') {
      next();
      return;
    }

    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const requestWithCorrelationId = req as RequestWithCorrelationId;
      const path = req.originalUrl || req.url;

      this.logger.log(
        `${req.method} ${path} -> ${res.statusCode} (${elapsedMs.toFixed(1)}ms) [${requestWithCorrelationId.requestId ?? 'n/a'}]`,
      );
    });

    next();
  }
}
