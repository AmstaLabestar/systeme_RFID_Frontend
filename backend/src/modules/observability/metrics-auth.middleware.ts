import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const METRICS_AUTH_CHALLENGE = 'Basic realm="metrics", charset="UTF-8"';

interface BasicCredentials {
  username: string;
  password: string;
}

function readHeaderValue(headerValue: string | string[] | undefined): string | undefined {
  if (Array.isArray(headerValue)) {
    return headerValue[0];
  }
  return headerValue;
}

function parseBasicCredentials(authorizationHeader: string): BasicCredentials | null {
  const [scheme, encoded] = authorizationHeader.trim().split(/\s+/, 2);
  if (!scheme || !encoded || scheme.toLowerCase() !== 'basic') {
    return null;
  }

  let decoded = '';
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    return null;
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex <= 0) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

@Injectable()
export class MetricsAuthMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const metricsEnabled = this.configService.get<boolean>('METRICS_ENABLED') ?? false;
    if (!metricsEnabled) {
      next();
      return;
    }

    const authMode = this.configService.get<'none' | 'basic'>('METRICS_AUTH_MODE') ?? 'none';
    if (authMode !== 'basic') {
      next();
      return;
    }

    const expectedUsername = this.configService.get<string>('METRICS_BASIC_AUTH_USERNAME') ?? '';
    const expectedPassword = this.configService.get<string>('METRICS_BASIC_AUTH_PASSWORD') ?? '';
    if (!expectedUsername || !expectedPassword) {
      this.rejectUnauthorized(res, next);
      return;
    }

    const authorizationHeader = readHeaderValue(req.headers.authorization);
    if (!authorizationHeader) {
      this.rejectUnauthorized(res, next);
      return;
    }

    const credentials = parseBasicCredentials(authorizationHeader);
    if (!credentials) {
      this.rejectUnauthorized(res, next);
      return;
    }

    const isUsernameValid = constantTimeEquals(credentials.username, expectedUsername);
    const isPasswordValid = constantTimeEquals(credentials.password, expectedPassword);
    if (!isUsernameValid || !isPasswordValid) {
      this.rejectUnauthorized(res, next);
      return;
    }

    next();
  }

  private rejectUnauthorized(res: Response, next: NextFunction): void {
    res.setHeader('WWW-Authenticate', METRICS_AUTH_CHALLENGE);
    next(new UnauthorizedException('Metrics authentication required.'));
  }
}
