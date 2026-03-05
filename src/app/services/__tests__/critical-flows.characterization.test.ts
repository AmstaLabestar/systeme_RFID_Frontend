import { beforeEach, describe, expect, it, vi } from 'vitest';

const httpMocks = vi.hoisted(() => ({
  authPost: vi.fn(),
  authGet: vi.fn(),
  systemPost: vi.fn(),
  systemGet: vi.fn(),
  systemPatch: vi.fn(),
}));

vi.mock('@/app/services/httpClient', () => ({
  authApiClient: {
    post: httpMocks.authPost,
    get: httpMocks.authGet,
  },
  systemApiClient: {
    post: httpMocks.systemPost,
    get: httpMocks.systemGet,
    patch: httpMocks.systemPatch,
  },
  toApiErrorMessage: (error: unknown, fallbackMessage: string) =>
    error instanceof Error && error.message.trim().length > 0 ? error.message : fallbackMessage,
}));

import { authService } from '@/app/services/authService';
import { marketplaceService } from '@/app/services/marketplaceService';

const MARKETPLACE_SYSTEMS_FIXTURE = [
  {
    code: 'RFID_PRESENCE',
    name: 'RFID Presence',
    hasIdentifiers: true,
    identifiersPerDevice: 5,
    identifierType: 'BADGE',
    availableDevices: 10,
    availableExtensions: 40,
    deviceUnitPriceCents: 21000,
    extensionUnitPriceCents: 1000,
    currency: 'XOF',
  },
];

const MARKETPLACE_STATE_FIXTURE = {
  devices: [
    {
      id: 'device-1',
      macAddress: 'AA:70:31:00:00:01',
      status: 'ASSIGNED',
      isConfigured: false,
      system: {
        code: 'RFID_PRESENCE',
        name: 'RFID Presence',
      },
      identifiers: [],
    },
  ],
  standaloneIdentifiers: [],
  pagination: {
    devices: { nextCursor: null, hasMore: false, limit: 50 },
    standaloneIdentifiers: { nextCursor: null, hasMore: false, limit: 50 },
  },
};

describe('Critical frontend flows characterization', () => {
  beforeEach(() => {
    httpMocks.authPost.mockReset();
    httpMocks.authGet.mockReset();
    httpMocks.systemPost.mockReset();
    httpMocks.systemGet.mockReset();
    httpMocks.systemPatch.mockReset();
  });

  it('login flow: normalizes identifier and returns public auth payload', async () => {
    httpMocks.authPost.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
          company: 'RFID',
          role: { name: 'member' },
        },
        redirectTo: '/dashboard/overview',
      },
    });

    const result = await authService.signIn({
      identifier: '  ADA@EXAMPLE.COM ',
      password: 'StrongPass#123',
    });

    expect(httpMocks.authPost).toHaveBeenCalledTimes(1);
    expect(httpMocks.authPost).toHaveBeenCalledWith(
      '/auth/signin',
      {
        identifier: 'ada@example.com',
        password: 'StrongPass#123',
      },
      expect.objectContaining({
        _skipAuthHeader: true,
        _skipAuthRefresh: true,
      }),
    );

    expect(result).toEqual({
      redirectTo: '/dashboard/overview',
      user: {
        id: 'user-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        company: 'RFID',
        roleName: 'member',
      },
    });
    const resultRecord = result as unknown as Record<string, unknown>;
    expect('accessToken' in resultRecord).toBe(false);
    expect('refreshToken' in resultRecord).toBe(false);
  });

  it('purchase flow: sends marketplace order payload with idempotency header and refreshes state', async () => {
    httpMocks.systemPost.mockResolvedValueOnce({
      data: {
        order: {
          id: 'order-1',
          status: 'COMPLETED',
          system: { code: 'RFID_PRESENCE' },
        },
        allocatedDevices: [
          {
            id: 'device-1',
            macAddress: 'AA:70:31:00:00:01',
            status: 'ASSIGNED',
            isConfigured: false,
            system: {
              code: 'RFID_PRESENCE',
              name: 'RFID Presence',
            },
            identifiers: [],
          },
        ],
        allocatedIdentifiers: [],
      },
    });
    httpMocks.systemGet
      .mockResolvedValueOnce({ data: MARKETPLACE_SYSTEMS_FIXTURE })
      .mockResolvedValueOnce({ data: MARKETPLACE_STATE_FIXTURE });

    const result = await marketplaceService.purchaseProduct({
      productId: 'device-rfid-presence',
      quantity: 1,
    });

    expect(httpMocks.systemPost).toHaveBeenCalledTimes(1);
    expect(httpMocks.systemPost).toHaveBeenCalledWith(
      '/marketplace/orders',
      {
        systemCode: 'RFID_PRESENCE',
        targetType: 'DEVICE',
        quantity: 1,
      },
      {
        headers: {
          'Idempotency-Key': expect.stringMatching(/^order:device-rfid-presence:1:/),
        },
      },
    );
    expect(httpMocks.systemGet).toHaveBeenCalledTimes(2);

    expect(result.purchaseId).toBe('order-1');
    expect(result.redirectModule).toBe('rfid-presence');
    expect(result.createdDevices).toHaveLength(1);
    expect(result.createdDevices[0]?.id).toBe('device-1');
    expect(result.marketplaceState.productStockById['device-rfid-presence']).toBe(10);
  });

  it('activation flow: sends device configuration payload and returns updated marketplace state', async () => {
    httpMocks.systemPatch.mockResolvedValueOnce({
      data: {
        id: 'device-1',
        macAddress: 'AA:70:31:00:00:01',
        status: 'ASSIGNED',
        configuredName: 'Front Desk',
        configuredLocation: 'Reception',
        isConfigured: true,
        systemIdentifier: 'AA:70:31:00:00:01',
        system: {
          code: 'RFID_PRESENCE',
          name: 'RFID Presence',
        },
        identifiers: [],
      },
    });
    httpMocks.systemGet
      .mockResolvedValueOnce({ data: MARKETPLACE_SYSTEMS_FIXTURE })
      .mockResolvedValueOnce({ data: MARKETPLACE_STATE_FIXTURE });

    const result = await marketplaceService.activateDevice('device-1', {
      name: 'Front Desk',
      location: 'Reception',
      systemIdentifier: 'AA:70:31:00:00:01',
    });

    expect(httpMocks.systemPatch).toHaveBeenCalledTimes(1);
    expect(httpMocks.systemPatch).toHaveBeenCalledWith('/devices/device-1/configure', {
      name: 'Front Desk',
      location: 'Reception',
      systemIdentifier: 'AA:70:31:00:00:01',
    });
    expect(httpMocks.systemGet).toHaveBeenCalledTimes(2);

    expect(result.device.id).toBe('device-1');
    expect(result.device.configured).toBe(true);
    expect(result.device.location).toBe('Reception');
    expect(result.marketplaceState.devices.some((device) => device.id === 'device-1')).toBe(true);
  });
});
