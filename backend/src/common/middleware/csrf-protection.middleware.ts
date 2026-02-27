import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { readCookieValue } from '../utils/security.util';

const CSRF_EXEMPT_PATHS = new Set([
  '/auth/login',
  '/auth/signin',
  '/auth/register',
  '/auth/signup',
  '/auth/google',
  '/auth/google/verify',
  '/auth/magic-link',
  '/auth/magic-link/verify',
  '/auth/refresh',
  '/login',
  '/signin',
  '/register',
  '/signup',
  '/google',
  '/google/verify',
  '/magic-link',
  '/magic-link/verify',
  '/refresh',
]);

function normalizePath(pathname: string): string {
  const [withoutQuery] = pathname.split('?');
  if (!withoutQuery) {
    return '/';
  }

  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  const trimmed =
    withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')
      ? withLeadingSlash.slice(0, -1)
      : withLeadingSlash;

  return trimmed.toLowerCase();
}

function isCsrfExemptPath(pathname: string): boolean {
  const normalizedPath = normalizePath(pathname);
  return (
    CSRF_EXEMPT_PATHS.has(normalizedPath) ||
    normalizedPath.startsWith('/public/feedback/') ||
    normalizedPath.startsWith('/feedback/')
  );
}

function isRequestPathCsrfExempt(req: Request): boolean {
  const candidates = [req.originalUrl, req.path, req.baseUrl].filter(
    (value): value is string => Boolean(value),
  );

  return candidates.some((candidate) => isCsrfExemptPath(candidate));
}

@Injectable()
export class CsrfProtectionMiddleware implements NestMiddleware {
  private readonly csrfCookieName: string;

  constructor(private readonly configService: ConfigService) {
    this.csrfCookieName =
      this.configService.get<string>('AUTH_CSRF_COOKIE_NAME') ?? 'rfid.csrf_token';
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    const method = req.method.toUpperCase();
    const isMutatingMethod =
      method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

    if (!isMutatingMethod || isRequestPathCsrfExempt(req)) {
      next();
      return;
    }

    const authorizationHeader = req.headers.authorization;
    if (
      typeof authorizationHeader === 'string' &&
      authorizationHeader.trim().toLowerCase().startsWith('bearer ')
    ) {
      next();
      return;
    }

    const csrfHeaderValue = req.headers['x-csrf-token'];
    const csrfHeader = Array.isArray(csrfHeaderValue)
      ? csrfHeaderValue[0]
      : csrfHeaderValue;
    const csrfCookie = readCookieValue(req.headers.cookie, this.csrfCookieName);

    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      next(new ForbiddenException('CSRF token missing or invalid.'));
      return;
    }

    next();
  }
}
