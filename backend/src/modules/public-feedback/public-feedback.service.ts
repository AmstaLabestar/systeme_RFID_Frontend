import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeviceStatus, FeedbackSentiment, FeedbackSource, HardwareSystemCode } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SubmitPublicFeedbackDto } from './dto/submit-public-feedback.dto';

const QR_FEEDBACK_COOLDOWN_MS = 2 * 60 * 1000;
const QR_FEEDBACK_COMMENT_MAX_LENGTH = 280;

function toFeedbackSentiment(value: string): FeedbackSentiment | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'NEGATIVE') {
    return FeedbackSentiment.NEGATIVE;
  }
  if (normalized === 'NEUTRAL') {
    return FeedbackSentiment.NEUTRAL;
  }
  if (normalized === 'POSITIVE') {
    return FeedbackSentiment.POSITIVE;
  }
  return null;
}

@Injectable()
export class PublicFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submitByQrToken(qrToken: string, dto: SubmitPublicFeedbackDto) {
    const normalizedQrToken = qrToken.trim();
    const sentiment = toFeedbackSentiment(dto.value);

    if (!normalizedQrToken || !sentiment) {
      throw new BadRequestException(
        'Payload invalide. Utilisez value: NEGATIVE | NEUTRAL | POSITIVE.',
      );
    }

    let comment: string | undefined;
    if (dto.comment !== undefined && dto.comment !== null) {
      const sanitizedComment = dto.comment.trim();
      if (sanitizedComment.length > QR_FEEDBACK_COMMENT_MAX_LENGTH) {
        throw new BadRequestException(
          `Le commentaire ne doit pas depasser ${QR_FEEDBACK_COMMENT_MAX_LENGTH} caracteres.`,
        );
      }
      comment = sanitizedComment.length > 0 ? sanitizedComment : undefined;
    }

    const feedbackDevice = await this.prisma.device.findFirst({
      where: {
        qrCodeToken: normalizedQrToken,
        status: DeviceStatus.ASSIGNED,
        ownerId: {
          not: null,
        },
        system: {
          code: HardwareSystemCode.FEEDBACK,
        },
      },
      select: {
        id: true,
        ownerId: true,
        isConfigured: true,
      },
    });

    if (!feedbackDevice) {
      throw new NotFoundException('Lien QR invalide ou introuvable.');
    }

    if (!feedbackDevice.isConfigured) {
      throw new BadRequestException('Ce boitier feedback n est pas actif.');
    }

    const targetUserId = feedbackDevice.ownerId;
    const targetDeviceId = feedbackDevice.id;

    if (!targetUserId || !targetDeviceId) {
      throw new NotFoundException('Lien QR invalide ou introuvable.');
    }

    const latestQrFeedback = await this.prisma.feedbackEvent.findFirst({
      where: {
        ownerId: targetUserId,
        deviceId: targetDeviceId,
        source: FeedbackSource.QR,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });

    const latestQrTimestamp = latestQrFeedback?.createdAt.getTime() ?? 0;
    const now = Date.now();

    if (latestQrTimestamp > 0 && now - latestQrTimestamp < QR_FEEDBACK_COOLDOWN_MS) {
      const retryAfterInSeconds = Math.ceil((QR_FEEDBACK_COOLDOWN_MS - (now - latestQrTimestamp)) / 1000);
      throw new HttpException(
        `Merci de patienter ${retryAfterInSeconds}s avant un nouveau feedback sur ce boitier.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.feedbackEvent.create({
      data: {
        ownerId: targetUserId,
        deviceId: targetDeviceId,
        sentiment,
        source: FeedbackSource.QR,
        comment,
      },
    });

    return {
      success: true,
      message: 'Feedback enregistre. Merci pour votre retour.',
    };
  }
}
