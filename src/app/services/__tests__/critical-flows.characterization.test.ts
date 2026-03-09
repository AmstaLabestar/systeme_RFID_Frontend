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
import { accessService } from '@/app/services/accessService';
import { toPresenceRealtimeScanEvent } from '@/app/services/contracts';
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

  it('presence snapshot flow: sends query params and normalizes response payload', async () => {
    httpMocks.systemGet.mockResolvedValueOnce({
      data: {
        lookbackHours: 12,
        periodStartAt: '2026-03-05T00:00:00.000Z',
        periodEndAt: '2026-03-05T12:00:00.000Z',
        totals: {
          totalScans: 18,
          attributedScans: 15,
          unattributedScans: 3,
          activeEmployees: 6,
        },
        byDevice: [
          {
            deviceId: 'device-1',
            deviceName: 'Front Desk',
            totalScans: 12,
            attributedScans: 10,
            unattributedScans: 2,
            lastScanAt: '2026-03-05T11:59:00.000Z',
          },
        ],
        lastScans: [
          {
            id: 'event-1',
            deviceId: 'device-1',
            deviceName: 'Front Desk',
            employee: 'Ada Lovelace',
            identifier: 'BADGE-001',
            occurredAt: '2026-03-05T11:59:00.000Z',
            attributed: true,
          },
        ],
      },
    });

    const snapshot = await accessService.fetchPresenceSnapshot({
      lookbackHours: 12,
      lastEventsLimit: 25,
    });

    expect(httpMocks.systemGet).toHaveBeenCalledTimes(1);
    expect(httpMocks.systemGet).toHaveBeenCalledWith('/services/presence/snapshot', {
      params: {
        lookbackHours: 12,
        lastEventsLimit: 25,
      },
    });
    expect(snapshot.lookbackHours).toBe(12);
    expect(snapshot.totals.totalScans).toBe(18);
    expect(snapshot.byDevice[0]?.deviceId).toBe('device-1');
    expect(snapshot.lastScans[0]?.attributed).toBe(true);
  });

  it('presence realtime mapping: normalizes server-sent scan payload', () => {
    const normalized = toPresenceRealtimeScanEvent({
      id: 'stream-1',
      historyEventId: 'history-1',
      deviceId: 'device-1',
      deviceName: 'Front Desk',
      employeeName: 'Ada Lovelace',
      identifierCode: 'BADGE-001',
      attributed: true,
      occurredAt: '2026-03-05T12:00:00.000Z',
      ingestionEventId: 'event-1',
      ingestionInboxId: 'inbox-1',
    });

    expect(normalized.id).toBe('stream-1');
    expect(normalized.historyEventId).toBe('history-1');
    expect(normalized.deviceId).toBe('device-1');
    expect(normalized.attributed).toBe(true);
  });
});
