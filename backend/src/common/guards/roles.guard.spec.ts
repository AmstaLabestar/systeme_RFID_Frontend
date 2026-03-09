import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function createExecutionContext(user?: unknown) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  let guard: RolesGuard;

  beforeEach(() => {
    guard = new RolesGuard(reflector as unknown as Reflector, prisma as any);
  });

  it('allows requests without role metadata', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined);

    await expect(guard.canActivate(createExecutionContext())).resolves.toBe(true);
  });

  it('rejects when the request is unauthenticated', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['admin']);

    await expect(guard.canActivate(createExecutionContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows matching roles in the same tenant', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['admin']);
    prisma.user.findUnique.mockResolvedValueOnce({
      tenantId: 'tenant-1',
      role: {
        name: 'admin',
        tenantId: 'tenant-1',
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

  it('rejects mismatched roles or tenants', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['admin']);
    prisma.user.findUnique.mockResolvedValueOnce({
      tenantId: 'tenant-2',
      role: {
        name: 'member',
        tenantId: 'tenant-2',
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
