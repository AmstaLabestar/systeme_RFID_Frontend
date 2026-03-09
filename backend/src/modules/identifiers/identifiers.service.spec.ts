import { BadRequestException } from '@nestjs/common';
import { IdentifierStatus } from '@prisma/client';
import { IdentifiersService } from './identifiers.service';

describe('IdentifiersService', () => {
  const prisma = {
    identifier: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: IdentifiersService;

  beforeEach(() => {
    service = new IdentifiersService(prisma as any);
  });

  it('normalizes MAC addresses and generic identifiers', () => {
    expect(
      service.normalizePhysicalIdentifiers(['aa-bb-cc-dd-ee-ff', ' badge-001 ']),
    ).toEqual(['AA:BB:CC:DD:EE:FF', 'BADGE-001']);
  });

  it('rejects duplicate normalized identifiers', () => {
    expect(() => service.normalizePhysicalIdentifiers(['badge-001', ' BADGE-001 '])).toThrow(
      BadRequestException,
    );
  });

  it('creates identifiers through Prisma and returns them ordered by creation date', async () => {
    prisma.identifier.createMany.mockResolvedValueOnce({ count: 2 });
    prisma.identifier.findMany.mockResolvedValueOnce([
      { id: 'identifier-1' },
      { id: 'identifier-2' },
    ]);

    await expect(
      service.createIdentifiers({
        systemId: 'system-1',
        type: 'BADGE',
        physicalIdentifiers: [' badge-001 ', 'aa-bb-cc-dd-ee-ff'],
        deviceId: 'device-1',
        createdById: 'admin-1',
        warehouseCode: 'WH-A',
      }),
    ).resolves.toEqual([{ id: 'identifier-1' }, { id: 'identifier-2' }]);
    expect(prisma.identifier.createMany).toHaveBeenCalledWith({
      data: [
        {
          systemId: 'system-1',
          type: 'BADGE',
          physicalIdentifier: 'BADGE-001',
          status: IdentifierStatus.IN_STOCK,
          deviceId: 'device-1',
          warehouseCode: 'WH-A',
          createdById: 'admin-1',
        },
        {
          systemId: 'system-1',
          type: 'BADGE',
          physicalIdentifier: 'AA:BB:CC:DD:EE:FF',
          status: IdentifierStatus.IN_STOCK,
          deviceId: 'device-1',
          warehouseCode: 'WH-A',
          createdById: 'admin-1',
        },
      ],
    });
  });
});
