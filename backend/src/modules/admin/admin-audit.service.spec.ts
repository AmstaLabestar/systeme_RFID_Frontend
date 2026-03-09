import { AdminAuditService } from './admin-audit.service';

describe('AdminAuditService', () => {
  const prisma = {
    adminActionLog: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: AdminAuditService;

  beforeEach(() => {
    service = new AdminAuditService(prisma as any);
  });

  it('creates audit logs with optional JSON details', async () => {
    prisma.adminActionLog.create.mockResolvedValueOnce({ id: 'log-1' });

    await expect(
      service.createLog({
        actorId: 'admin-1',
        action: 'SYSTEM_CREATED',
        targetType: 'SYSTEM',
        targetId: 'system-1',
        details: {
          code: 'RFID_PRESENCE',
        },
      }),
    ).resolves.toEqual({ id: 'log-1' });
    expect(prisma.adminActionLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'SYSTEM_CREATED',
        targetType: 'SYSTEM',
        targetId: 'system-1',
        details: {
          code: 'RFID_PRESENCE',
        },
      },
    });
  });

  it('lists audit logs with filters and pagination', async () => {
    prisma.adminActionLog.count.mockResolvedValueOnce(3);
    prisma.adminActionLog.findMany.mockResolvedValueOnce([{ id: 'log-1' }]);

    await expect(
      service.listLogs({
        tenantId: 'tenant-1',
        page: 2,
        limit: 10,
        action: 'SYSTEM_CREATED',
        targetType: 'SYSTEM',
        actorId: 'admin-1',
      }),
    ).resolves.toEqual({
      total: 3,
      page: 2,
      limit: 10,
      items: [{ id: 'log-1' }],
    });
    expect(prisma.adminActionLog.count).toHaveBeenCalledWith({
      where: {
        actor: {
          tenantId: 'tenant-1',
        },
        action: 'SYSTEM_CREATED',
        targetType: 'SYSTEM',
        actorId: 'admin-1',
      },
    });
    expect(prisma.adminActionLog.findMany).toHaveBeenCalledWith({
      where: {
        actor: {
          tenantId: 'tenant-1',
        },
        action: 'SYSTEM_CREATED',
        targetType: 'SYSTEM',
        actorId: 'admin-1',
      },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 10,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  });
});
