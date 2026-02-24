import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeviceStatus, HardwareSystemCode } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  QR_FEEDBACK_COMMENT_MAX_LENGTH,
  QR_FEEDBACK_COOLDOWN_MS,
} from '../systems/domain/system-state.constants';
import {
  createId,
  getLatestQrFeedbackTimestamp,
  toFeedbackSentimentFromPublicValue,
} from '../systems/domain/system-state.utils';
import { SystemsStateService } from '../systems/systems-state.service';
import { SubmitPublicFeedbackDto } from './dto/submit-public-feedback.dto';

@Injectable()
export class PublicFeedbackService {
  constructor(
    private readonly systemsStateService: SystemsStateService,
    private readonly prisma: PrismaService,
  ) {}

  async submitByQrToken(qrToken: string, dto: SubmitPublicFeedbackDto) {
    const normalizedQrToken = qrToken.trim();
    const sentiment = toFeedbackSentimentFromPublicValue(dto.value);

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

    const dbFeedbackDevice = await this.prisma.device.findFirst({
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

    const fallbackDevice = dbFeedbackDevice
      ? null
      : await this.systemsStateService.findFeedbackDeviceByQrToken(normalizedQrToken);

    if (!dbFeedbackDevice && !fallbackDevice) {
      throw new NotFoundException('Lien QR invalide ou introuvable.');
    }

    if (dbFeedbackDevice && !dbFeedbackDevice.isConfigured) {
      throw new BadRequestException('Ce boitier feedback n est pas actif.');
    }

    if (fallbackDevice && !fallbackDevice.device.configured) {
      throw new BadRequestException('Ce boitier feedback n est pas actif.');
    }

    const targetUserId = dbFeedbackDevice?.ownerId ?? fallbackDevice?.userId;
    const targetDeviceId = dbFeedbackDevice?.id ?? fallbackDevice?.device.id;

    if (!targetUserId || !targetDeviceId) {
      throw new NotFoundException('Lien QR invalide ou introuvable.');
    }

    const servicesState = await this.systemsStateService.getServicesState(targetUserId);
    const latestQrTimestamp = getLatestQrFeedbackTimestamp(servicesState, targetDeviceId);
    const now = Date.now();

    if (latestQrTimestamp > 0 && now - latestQrTimestamp < QR_FEEDBACK_COOLDOWN_MS) {
      const retryAfterInSeconds = Math.ceil((QR_FEEDBACK_COOLDOWN_MS - (now - latestQrTimestamp)) / 1000);
      throw new HttpException(
        `Merci de patienter ${retryAfterInSeconds}s avant un nouveau feedback sur ce boitier.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const feedbackRecord = {
      id: createId('fb'),
      deviceId: targetDeviceId,
      module: 'feedback' as const,
      sentiment,
      source: 'QR' as const,
      comment,
      createdAt: new Date(now).toISOString(),
    };

    servicesState.feedbackRecords = [feedbackRecord, ...servicesState.feedbackRecords];
    await this.systemsStateService.saveServicesState(targetUserId, servicesState);

    return {
      success: true,
      message: 'Feedback enregistre. Merci pour votre retour.',
    };
  }
}
