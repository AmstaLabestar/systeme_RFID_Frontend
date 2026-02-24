import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { normalizeEmail } from '../../../common/utils/security.util';

export interface GoogleIdentity {
  googleId: string;
  email: string;
  name: string;
}

@Injectable()
export class GoogleTokenVerifierService {
  private readonly oauthClient = new OAuth2Client();
  private readonly googleClientId: string;

  constructor(private readonly configService: ConfigService) {
    this.googleClientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
  }

  async verifyIdToken(idToken: string): Promise<GoogleIdentity> {
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new UnauthorizedException('Invalid Google token payload.');
      }

      if (payload.email_verified === false) {
        throw new UnauthorizedException('Google account email is not verified.');
      }

      const name =
        payload.name?.trim() ||
        `${payload.given_name ?? ''} ${payload.family_name ?? ''}`.trim() ||
        'Google User';

      return {
        googleId: payload.sub,
        email: normalizeEmail(payload.email),
        name,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Google token verification failed.');
    }
  }
}
