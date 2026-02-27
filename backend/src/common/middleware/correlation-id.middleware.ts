import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { resolveCorrelationId } from '../utils/security.util';

export type RequestWithCorrelationId = Request & { requestId?: string };

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithCorrelationId, res: Response, next: NextFunction): void {
    const correlationHeaderValue = req.headers['x-correlation-id'];
    const requestId = resolveCorrelationId(
      Array.isArray(correlationHeaderValue) ? correlationHeaderValue[0] : correlationHeaderValue,
    );

    req.requestId = requestId;
    res.setHeader('x-correlation-id', requestId);
    next();
  }
}
