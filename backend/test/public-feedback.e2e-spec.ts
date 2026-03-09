import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SanitizeBodyPipe } from '../src/common/pipes/sanitize-body.pipe';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { PublicFeedbackController } from '../src/modules/public-feedback/public-feedback.controller';
import { PublicFeedbackService } from '../src/modules/public-feedback/public-feedback.service';

describe('Public feedback e2e', () => {
  const prismaService = {
    device: {
      findFirst: jest.fn(),
    },
    feedbackEvent: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicFeedbackController],
      providers: [
        PublicFeedbackService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new SanitizeBodyPipe(),
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns validation errors for invalid feedback payloads', async () => {
    await request(app.getHttpServer())
      .post('/public/feedback/token-1')
      .send({
        value: 'BAD',
      })
      .expect(400);
  });

  it('returns 404 for unknown QR tokens', async () => {
    prismaService.device.findFirst.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .post('/public/feedback/token-1')
      .send({
        value: 'NEGATIVE',
      })
      .expect(404);

    expect(response.body.message).toBe('Lien QR invalide ou introuvable.');
  });

  it('accepts a valid feedback submission', async () => {
    prismaService.device.findFirst.mockResolvedValueOnce({
      id: 'device-1',
      ownerId: 'owner-1',
      isConfigured: true,
    });
    prismaService.feedbackEvent.findFirst.mockResolvedValueOnce(null);
    prismaService.feedbackEvent.create.mockResolvedValueOnce({ id: 'feedback-1' });

    const response = await request(app.getHttpServer())
      .post('/public/feedback/token-1')
      .send({
        value: 'POSITIVE',
        comment: ' Great service ',
      })
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      message: 'Feedback enregistre. Merci pour votre retour.',
    });
    expect(prismaService.feedbackEvent.create).toHaveBeenCalledWith({
      data: {
        ownerId: 'owner-1',
        deviceId: 'device-1',
        sentiment: 'POSITIVE',
        source: 'QR',
        comment: 'Great service',
      },
    });
  });
});
