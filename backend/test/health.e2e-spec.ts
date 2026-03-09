import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthController } from '../src/modules/health/health.controller';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('Health e2e', () => {
  const prismaService = {
    $queryRaw: jest.fn(),
  };

  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the health payload', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('rfid-backend');
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('returns the liveness payload', async () => {
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);

    expect(response.body.status).toBe('live');
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('returns readiness when the database probe succeeds', async () => {
    prismaService.$queryRaw.mockResolvedValueOnce([1]);

    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

    expect(response.body).toMatchObject({
      status: 'ready',
      checks: {
        database: 'up',
      },
    });
  });

  it('returns not-ready when the database probe fails', async () => {
    prismaService.$queryRaw.mockRejectedValueOnce(new Error('db down'));

    const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

    expect(response.body).toMatchObject({
      status: 'not-ready',
      checks: {
        database: 'down',
      },
    });
  });
});
