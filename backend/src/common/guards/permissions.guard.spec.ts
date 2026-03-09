import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../permissions.constants';
import { PermissionsGuard } from './permissions.guard';

function createExecutionContext(user?: unknown) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe('PermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  let guard: PermissionsGuard;

  beforeEach(() => {
    guard = new PermissionsGuard(reflector as unknown as Reflector, prisma as any);
  });

  it('allows requests without required permissions metadata', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined);

    await expect(guard.canActivate(createExecutionContext())).resolves.toBe(true);
  });

  it('rejects when no authenticated user is present', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce([PERMISSIONS.users.read]);

    await expect(guard.canActivate(createExecutionContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('falls back to default role permissions when the database role has none', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce([PERMISSIONS.users.read]);
    prisma.user.findUnique.mockResolvedValueOnce({
      tenantId: 'tenant-1',
      role: {
        name: 'owner',
        tenantId: 'tenant-1',
        permissions: [],
      },
    });

    await expect(
      guard.canActivate(
        createExecutionContext({
          userId: 'user-1',
          tenantId: 'tenant-1',
        }),
      ),
    ).resolves.toBe(true);
  });

  it('accepts explicit wildcard permission scopes', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce([PERMISSIONS.users.manage]);
    prisma.user.findUnique.mockResolvedValueOnce({
      tenantId: 'tenant-1',
      role: {
        name: 'custom',
        tenantId: 'tenant-1',
        permissions: ['users.*'],
      },
    });

    await expect(
      guard.canActivate(
        createExecutionContext({
          userId: 'user-1',
          tenantId: 'tenant-1',
        }),
      ),
    ).resolves.toBe(true);
  });

  it('rejects when the tenant mismatches or permissions are missing', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce([PERMISSIONS.users.manage]);
    prisma.user.findUnique.mockResolvedValueOnce({
      tenantId: 'tenant-2',
      role: {
        name: 'custom',
        tenantId: 'tenant-2',
        permissions: ['roles.read'],
      },
    });

    await expect(
      guard.canActivate(
        createExecutionContext({
          userId: 'user-1',
          tenantId: 'tenant-1',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
