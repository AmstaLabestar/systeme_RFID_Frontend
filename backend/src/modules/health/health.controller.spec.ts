import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const prismaService = {
    $queryRaw: jest.fn(),
  };

  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('returns a service health payload', () => {
    const result = controller.health();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('rfid-backend');
    expect(typeof result.uptimeSeconds).toBe('number');
    expect(typeof result.timestamp).toBe('string');
  });

  it('returns a liveness payload', () => {
    const result = controller.liveness();

    expect(result).toMatchObject({
      status: 'live',
    });
    expect(typeof result.timestamp).toBe('string');
  });

  it('returns readiness details when the database probe succeeds', async () => {
    prismaService.$queryRaw.mockResolvedValueOnce([1]);

    const result = await controller.readiness();

    expect(result.status).toBe('ready');
    expect(result.checks.database).toBe('up');
    expect(typeof result.checks.latencyMs).toBe('number');
    expect(prismaService.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('throws ServiceUnavailableException when the database probe fails', async () => {
    prismaService.$queryRaw.mockRejectedValueOnce(new Error('db down'));

    await expect(controller.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
