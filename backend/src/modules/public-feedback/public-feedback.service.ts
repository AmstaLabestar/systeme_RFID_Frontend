import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  constructor(private readonly systemsStateService: SystemsStateService) {}

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

    const resolvedDevice = await this.systemsStateService.findFeedbackDeviceByQrToken(
      normalizedQrToken,
    );

    if (!resolvedDevice) {
      throw new NotFoundException('Lien QR invalide ou introuvable.');
    }

    if (!resolvedDevice.device.configured) {
      throw new BadRequestException('Ce boitier feedback n est pas actif.');
    }

    const servicesState = await this.systemsStateService.getServicesState(resolvedDevice.userId);
    const latestQrTimestamp = getLatestQrFeedbackTimestamp(servicesState, resolvedDevice.device.id);
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
      deviceId: resolvedDevice.device.id,
      module: 'feedback' as const,
      sentiment,
      source: 'QR' as const,
      comment,
      createdAt: new Date(now).toISOString(),
    };

    servicesState.feedbackRecords = [feedbackRecord, ...servicesState.feedbackRecords];
    await this.systemsStateService.saveServicesState(resolvedDevice.userId, servicesState);

    return {
      success: true,
      message: 'Feedback enregistre. Merci pour votre retour.',
    };
  }
}
