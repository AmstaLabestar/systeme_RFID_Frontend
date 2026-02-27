import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { CsrfProtectionMiddleware } from './csrf-protection.middleware';

function createMiddleware(cookieName = 'rfid.csrf_token') {
  const configService = {
    get: jest.fn().mockReturnValue(cookieName),
  } as unknown as ConfigService;

  return new CsrfProtectionMiddleware(configService);
}

function createRequest(overrides?: Partial<Request>): Request {
  return {
    method: 'POST',
    path: '/secure/action',
    originalUrl: '/secure/action',
    baseUrl: '/secure',
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function createResponse(): Response {
  return {} as Response;
}

describe('CsrfProtectionMiddleware', () => {
  it('skips csrf validation for non-mutating methods', () => {
    const middleware = createMiddleware();
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(createRequest({ method: 'GET' }), createResponse(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('skips csrf validation for exempt auth routes', () => {
    const middleware = createMiddleware();
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(
      createRequest({
        path: '/auth/signin',
        originalUrl: '/auth/signin?source=web',
        baseUrl: '/auth',
      }),
      createResponse(),
      next,
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('skips csrf validation when bearer token is present', () => {
    const middleware = createMiddleware();
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(
      createRequest({
        headers: {
          authorization: 'Bearer token-value',
        },
      }),
      createResponse(),
      next,
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('blocks mutating request when csrf token is missing', () => {
    const middleware = createMiddleware();
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(createRequest(), createResponse(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0] as unknown;
    expect(error).toBeInstanceOf(ForbiddenException);
  });

  it('allows mutating request when csrf header and cookie match', () => {
    const middleware = createMiddleware();
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(
      createRequest({
        headers: {
          cookie: 'rfid.csrf_token=csrf123',
          'x-csrf-token': 'csrf123',
        },
      }),
      createResponse(),
      next,
    );

    expect(next).toHaveBeenCalledWith();
  });
});
