import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { MetricsAuthMiddleware } from './metrics-auth.middleware';

function createMiddleware(values: Record<string, unknown>): MetricsAuthMiddleware {
  const configService = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;

  return new MetricsAuthMiddleware(configService);
}

function createRequest(authorization?: string): Request {
  return {
    headers: authorization ? { authorization } : {},
  } as unknown as Request;
}

function createResponse(): Response {
  return {
    setHeader: jest.fn(),
  } as unknown as Response;
}

function buildBasicAuthorizationHeader(username: string, password: string): string {
  const encoded = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  return `Basic ${encoded}`;
}

describe('MetricsAuthMiddleware', () => {
  it('skips authentication when metrics are disabled', () => {
    const middleware = createMiddleware({
      METRICS_ENABLED: false,
      METRICS_AUTH_MODE: 'basic',
    });
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(createRequest(), createResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('skips authentication when auth mode is none', () => {
    const middleware = createMiddleware({
      METRICS_ENABLED: true,
      METRICS_AUTH_MODE: 'none',
    });
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(createRequest(), createResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects unauthenticated requests in basic mode', () => {
    const middleware = createMiddleware({
      METRICS_ENABLED: true,
      METRICS_AUTH_MODE: 'basic',
      METRICS_BASIC_AUTH_USERNAME: 'prometheus',
      METRICS_BASIC_AUTH_PASSWORD: 'a-very-strong-password',
    });
    const response = createResponse();
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(createRequest(), response, next);

    expect((response.setHeader as jest.Mock).mock.calls[0]).toEqual([
      'WWW-Authenticate',
      'Basic realm="metrics", charset="UTF-8"',
    ]);
    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0] as unknown;
    expect(error).toBeInstanceOf(UnauthorizedException);
  });

  it('rejects requests with invalid credentials', () => {
    const middleware = createMiddleware({
      METRICS_ENABLED: true,
      METRICS_AUTH_MODE: 'basic',
      METRICS_BASIC_AUTH_USERNAME: 'prometheus',
      METRICS_BASIC_AUTH_PASSWORD: 'a-very-strong-password',
    });
    const response = createResponse();
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(
      createRequest(buildBasicAuthorizationHeader('prometheus', 'wrong-password')),
      response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0] as unknown;
    expect(error).toBeInstanceOf(UnauthorizedException);
  });

  it('allows requests with valid credentials', () => {
    const middleware = createMiddleware({
      METRICS_ENABLED: true,
      METRICS_AUTH_MODE: 'basic',
      METRICS_BASIC_AUTH_USERNAME: 'prometheus',
      METRICS_BASIC_AUTH_PASSWORD: 'a-very-strong-password',
    });
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(
      createRequest(buildBasicAuthorizationHeader('prometheus', 'a-very-strong-password')),
      createResponse(),
      next,
    );

    expect(next).toHaveBeenCalledWith();
  });
});
