import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RequestMeta } from '../../../common/interfaces/request-meta.interface';
import { decryptSecret, encryptSecret, hashToken } from '../../../common/utils/security.util';
import type { AuthUserRecord } from '../../users/repositories/users.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import type {
  AuthResponseDto,
  LoginTwoFactorChallengeResponseDto,
  SetupTwoFactorResponseDto,
} from '../dto/auth-response.dto';
import { VerifyLoginTwoFactorDto } from '../dto/verify-login-2fa.dto';
import { AuthAttemptService } from './auth-attempt.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

interface OtplibAuthenticator {
  options: {
    step?: number;
    window?: number;
  };
  generateSecret(): string;
  keyuri(accountName: string, issuer: string, secret: string): string;
  check(token: string, secret: string): boolean;
}

interface QrCodeModule {
  toDataURL(content: string): Promise<string>;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticator } = require('otplib') as { authenticator: OtplibAuthenticator };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const qrCode = require('qrcode') as QrCodeModule;

@Injectable()
export class TwoFactorService {
  private readonly twoFactorEncryptionKey: string;
  private readonly totpIssuer: string;
  private readonly otpMaxAttempts: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersRepository: UsersRepository,
    private readonly authAttemptService: AuthAttemptService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
  ) {
    this.twoFactorEncryptionKey = this.configService.getOrThrow<string>('TWO_FACTOR_ENCRYPTION_KEY');
    this.totpIssuer = this.configService.get<string>('TOTP_ISSUER') ?? 'RFID SaaS';
    this.otpMaxAttempts = this.configService.getOrThrow<number>('OTP_MAX_ATTEMPTS');

    authenticator.options = {
      step: 30,
      window: 1,
    };
  }

  async verifyLoginTwoFactor(dto: VerifyLoginTwoFactorDto, meta: RequestMeta): Promise<AuthResponseDto> {
    const attemptKey = `2fa-login:${meta.ipAddress ?? 'unknown'}`;
    await this.authAttemptService.assertWithinLimit(attemptKey, this.otpMaxAttempts, 10 * 60_000);

    const payload = await this.tokenService.verifyAccessToken(dto.twoFactorToken);
    if (payload.isTwoFactorAuthenticated) {
      throw new BadRequestException('Token is already fully authenticated.');
    }

    const user = await this.usersRepository.findAuthById(payload.userId);
    if (!user || !user.isTwoFactorEnabled) {
      await this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Two-factor verification failed.');
    }

    const secret = this.readTwoFactorSecret(user);
    const isValidCode = authenticator.check(dto.code, secret);
    if (!isValidCode) {
      await this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Two-factor verification failed.');
    }

    await this.authAttemptService.reset(attemptKey);
    const tokens = await this.tokenService.issueTokens(user, meta);
    return this.sessionService.toAuthResponse(user, tokens, dto.redirectTo);
  }

  async setupTwoFactor(userId: string): Promise<SetupTwoFactorResponseDto> {
    const user = await this.usersRepository.findAuthById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.isTwoFactorEnabled) {
      throw new ConflictException('Two-factor is already enabled.');
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, this.totpIssuer, secret);
    const qrCodeDataUrl = await qrCode.toDataURL(otpauthUrl);
    const encryptedSecret = encryptSecret(secret, this.twoFactorEncryptionKey);

    await this.usersRepository.updateById(user.id, {
      twoFactorSecretEncrypted: encryptedSecret.encrypted,
      twoFactorSecretIv: encryptedSecret.iv,
      twoFactorSecretTag: encryptedSecret.tag,
      twoFactorSecretHash: encryptedSecret.hash,
      isTwoFactorEnabled: false,
    });

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
      isTwoFactorEnabled: false,
    };
  }

  async enableTwoFactor(
    userId: string,
    code: string,
  ): Promise<{ success: true; isTwoFactorEnabled: true }> {
    const user = await this.usersRepository.findAuthById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const secret = this.readTwoFactorSecret(user);
    const isValid = authenticator.check(code, secret);
    if (!isValid) {
      throw new UnauthorizedException('Two-factor verification failed.');
    }

    await this.usersRepository.updateById(user.id, {
      isTwoFactorEnabled: true,
    });

    return {
      success: true,
      isTwoFactorEnabled: true,
    };
  }

  async disableTwoFactor(
    userId: string,
    code: string,
  ): Promise<{ success: true; isTwoFactorEnabled: false }> {
    const user = await this.usersRepository.findAuthById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!user.isTwoFactorEnabled) {
      return {
        success: true,
        isTwoFactorEnabled: false,
      };
    }

    const secret = this.readTwoFactorSecret(user);
    const isValid = authenticator.check(code, secret);
    if (!isValid) {
      throw new UnauthorizedException('Two-factor verification failed.');
    }

    await this.usersRepository.updateById(user.id, {
      isTwoFactorEnabled: false,
      twoFactorSecretEncrypted: null,
      twoFactorSecretIv: null,
      twoFactorSecretTag: null,
      twoFactorSecretHash: null,
    });

    return {
      success: true,
      isTwoFactorEnabled: false,
    };
  }

  async createTwoFactorChallenge(
    user: AuthUserRecord,
    redirectTo?: string,
  ): Promise<LoginTwoFactorChallengeResponseDto> {
    const pendingToken = await this.tokenService.issueTwoFactorPendingToken(user);
    const expiresAt = new Date(Date.now() + this.tokenService.getTwoFactorStepTtlMs()).toISOString();

    return {
      requiresTwoFactor: true,
      twoFactorToken: pendingToken.token,
      expiresIn: pendingToken.expiresInSeconds,
      expiresAt,
      redirectTo: this.sessionService.resolveDashboardRedirect(redirectTo),
      user: {
        id: user.id,
        email: user.email,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      },
    };
  }

  private readTwoFactorSecret(user: AuthUserRecord): string {
    if (
      !user.twoFactorSecretEncrypted ||
      !user.twoFactorSecretIv ||
      !user.twoFactorSecretTag ||
      !user.twoFactorSecretHash
    ) {
      throw new BadRequestException('Two-factor setup is not initialized.');
    }

    try {
      const secret = decryptSecret(
        {
          encrypted: user.twoFactorSecretEncrypted,
          iv: user.twoFactorSecretIv,
          tag: user.twoFactorSecretTag,
        },
        this.twoFactorEncryptionKey,
      );

      if (hashToken(secret) !== user.twoFactorSecretHash) {
        throw new UnauthorizedException('Two-factor verification failed.');
      }

      return secret;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Unable to read two-factor secret.');
    }
  }
}
