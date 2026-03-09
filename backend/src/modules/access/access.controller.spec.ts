import { of } from 'rxjs';
import { Test } from '@nestjs/testing';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';

describe('AccessController', () => {
  const accessService = {
    getServicesState: jest.fn(),
    getPresenceSnapshot: jest.fn(),
    streamPresenceEvents: jest.fn(),
    assignIdentifier: jest.fn(),
    removeAssignment: jest.fn(),
    reassignIdentifier: jest.fn(),
    disableIdentifier: jest.fn(),
  };

  let controller: AccessController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AccessController],
      providers: [
        {
          provide: AccessService,
          useValue: accessService,
        },
      ],
    }).compile();

    controller = moduleRef.get(AccessController);
  });

  it('delegates state and presence reads to the service', async () => {
    const user = { userId: 'user-1' };
    const stateQuery = { paginate: true };
    const snapshotQuery = { lookbackHours: 24 };
    const stream = of({ data: { event: 'scan' } });
    accessService.getServicesState.mockResolvedValueOnce({ employees: [] });
    accessService.getPresenceSnapshot.mockResolvedValueOnce({ totals: {} });
    accessService.streamPresenceEvents.mockReturnValueOnce(stream);

    await expect(controller.getServicesState(user as any, stateQuery as any)).resolves.toEqual({
      employees: [],
    });
    await expect(controller.getPresenceSnapshot(user as any, snapshotQuery as any)).resolves.toEqual({
      totals: {},
    });
    expect(controller.streamPresence(user as any)).toBe(stream);
  });

  it('delegates assignment mutations to the service', async () => {
    const user = { userId: 'user-1' };
    accessService.assignIdentifier.mockResolvedValueOnce({ meta: { action: 'assign' } });
    accessService.removeAssignment.mockResolvedValueOnce({ meta: { action: 'remove' } });
    accessService.reassignIdentifier.mockResolvedValueOnce({ meta: { action: 'reassign' } });
    accessService.disableIdentifier.mockResolvedValueOnce({ meta: { action: 'disable' } });

    await expect(controller.assignIdentifier(user as any, { module: 'rfid-presence' } as any)).resolves.toEqual(
      { meta: { action: 'assign' } },
    );
    await expect(
      controller.removeAssignment(user as any, 'assignment-1', { reason: 'lost' } as any),
    ).resolves.toEqual({
      meta: { action: 'remove' },
    });
    await expect(
      controller.reassignIdentifier(user as any, 'assignment-1', { deviceId: 'device-2' } as any),
    ).resolves.toEqual({
      meta: { action: 'reassign' },
    });
    await expect(
      controller.disableIdentifier(user as any, 'identifier-1', { reason: 'lost' } as any),
    ).resolves.toEqual({
      meta: { action: 'disable' },
    });
  });
});
