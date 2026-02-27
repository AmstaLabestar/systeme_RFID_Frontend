import type { NextFunction, Request, Response } from 'express';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

function createRequest(headerValue?: string): Request & { requestId?: string } {
  return {
    headers: headerValue ? { 'x-correlation-id': headerValue } : {},
  } as unknown as Request & { requestId?: string };
}

function createResponse() {
  return {
    setHeader: jest.fn(),
  } as unknown as Response;
}

describe('CorrelationIdMiddleware', () => {
  it('reuses valid correlation id header', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = createRequest('rfid-request-12345');
    const res = createResponse();
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(req, res, next);

    expect(req.requestId).toBe('rfid-request-12345');
    expect((res.setHeader as jest.Mock).mock.calls[0]).toEqual([
      'x-correlation-id',
      'rfid-request-12345',
    ]);
    expect(next).toHaveBeenCalledWith();
  });

  it('generates a safe correlation id for invalid header value', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = createRequest('<bad>');
    const res = createResponse();
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(req, res, next);

    expect(req.requestId).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
    expect(req.requestId).not.toBe('<bad>');
    expect(next).toHaveBeenCalledWith();
  });
});
