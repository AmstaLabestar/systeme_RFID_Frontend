import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeviceStatus, FeedbackSentiment, FeedbackSource, HardwareSystemCode } from '@prisma/client';
import { PublicFeedbackService } from './public-feedback.service';

describe('PublicFeedbackService', () => {
  const prisma = {
    device: {
      findFirst: jest.fn(),
    },
    feedbackEvent: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  let service: PublicFeedbackService;

  beforeEach(() => {
    service = new PublicFeedbackService(prisma as any);
  });

  it('rejects invalid QR payload values', async () => {
    await expect(service.submitByQrToken('token-1', { value: 'BAD' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects comments longer than the QR feedback limit', async () => {
    await expect(
      service.submitByQrToken('token-1', {
        value: 'POSITIVE',
        comment: 'a'.repeat(281),
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the QR token does not map to an assigned feedback device', async () => {
    prisma.device.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.submitByQrToken('missing-token', { value: 'NEGATIVE' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when the feedback device exists but is not configured', async () => {
    prisma.device.findFirst.mockResolvedValueOnce({
      id: 'device-1',
      ownerId: 'owner-1',
      isConfigured: false,
      status: DeviceStatus.ASSIGNED,
      system: {
        code: HardwareSystemCode.FEEDBACK,
      },
    });

    await expect(
      service.submitByQrToken('feedback-token', { value: 'NEGATIVE' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces the QR cooldown window', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-09T10:00:00.000Z').getTime());
    prisma.device.findFirst.mockResolvedValueOnce({
      id: 'device-1',
      ownerId: 'owner-1',
      isConfigured: true,
    });
    prisma.feedbackEvent.findFirst.mockResolvedValueOnce({
      createdAt: new Date('2026-03-09T09:58:30.000Z'),
    });

    try {
      await service.submitByQrToken('feedback-token', { value: 'POSITIVE' } as any);
      throw new Error('Expected a cooldown exception.');
    } catch (error) {
      expect((error as { getStatus?: () => number }).getStatus?.()).toBe(429);
    }
  });

  it('stores a QR feedback record and returns a success payload', async () => {
    prisma.device.findFirst.mockResolvedValueOnce({
      id: 'device-1',
      ownerId: 'owner-1',
      isConfigured: true,
    });
    prisma.feedbackEvent.findFirst.mockResolvedValueOnce(null);
    prisma.feedbackEvent.create.mockResolvedValueOnce({
      id: 'feedback-1',
      sentiment: FeedbackSentiment.POSITIVE,
      source: FeedbackSource.QR,
    });

    await expect(
      service.submitByQrToken(' feedback-token ', {
        value: 'POSITIVE',
        comment: ' Great service ',
      } as any),
    ).resolves.toEqual({
      success: true,
      message: 'Feedback enregistre. Merci pour votre retour.',
    });
    expect(prisma.feedbackEvent.create).toHaveBeenCalledWith({
      data: {
        ownerId: 'owner-1',
        deviceId: 'device-1',
        sentiment: FeedbackSentiment.POSITIVE,
        source: FeedbackSource.QR,
        comment: 'Great service',
      },
    });
  });
});
