import { PUBLIC_ROUTES } from './contracts';
import { systemApiClient, toApiErrorMessage } from './httpClient';

export type PublicFeedbackValue = 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE';

export interface SubmitPublicFeedbackPayload {
  value: PublicFeedbackValue;
  comment?: string;
}

export interface SubmitPublicFeedbackResponse {
  success: boolean;
  message: string;
}

export const publicFeedbackService = {
  async submitByQrToken(
    qrToken: string,
    payload: SubmitPublicFeedbackPayload,
  ): Promise<SubmitPublicFeedbackResponse> {
    const normalizedToken = String(qrToken || '').trim();

    if (!normalizedToken) {
      throw new Error('Lien de feedback invalide.');
    }

    const comment = typeof payload.comment === 'string' ? payload.comment.trim() : '';
    const requestBody = comment.length > 0 ? { value: payload.value, comment } : { value: payload.value };
    try {
      const response = await systemApiClient.post<SubmitPublicFeedbackResponse>(
        PUBLIC_ROUTES.feedbackByQrToken(normalizedToken),
        requestBody,
        {
          _skipAuthHeader: true,
          _skipAuthRefresh: true,
        } as any,
      );

      return response.data;
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Envoi du feedback impossible.'));
    }
  },
};
