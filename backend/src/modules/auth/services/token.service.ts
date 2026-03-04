import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import ms from 'ms';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../../../common/interfaces/jwt-payload.interface';
import type { RequestMeta } from '../../../common/interfaces/request-meta.interface';
import { hashToken } from '../../../common/utils/security.util';
import type { AuthUserRecord } from '../../users/repositories/users.repository';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
  accessExpiresInSeconds: number;
}

export interface TwoFactorPendingToken {
  token: string;
  expiresInSeconds: number;
}

export interface MagicLinkPayload {
  userId: string;
  email: string;
  jti: string;
  type: 'magic-link';
  redirectTo?: string;
}

export interface IssuedMagicLinkToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;
  private readonly magicLinkTtl: string;
  private readonly twoFactorStepTtl: string;
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: number;
  private readonly magicLinkTtlMs: number;
  private readonly twoFactorStepTtlMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
  ) {
    this.accessSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.accessTtl = this.configService.getOrThrow<string>('JWT_ACCESS_TTL');
    this.refreshTtl = this.configService.getOrThrow<string>('JWT_REFRESH_TTL');
    this.magicLinkTtl = this.configService.getOrThrow<string>('MAGIC_LINK_TTL');
    this.twoFactorStepTtl = this.configService.get<string>('TWO_FACTOR_STEP_TTL') ?? '5m';
    this.accessTtlMs = this.parseDurationMs(this.accessTtl, 'JWT_ACCESS_TTL');
    this.refreshTtlMs = this.parseDurationMs(this.refreshTtl, 'JWT_REFRESH_TTL');
    this.magicLinkTtlMs = this.parseDurationMs(this.magicLinkTtl, 'MAGIC_LINK_TTL');
    this.twoFactorStepTtlMs = this.parseDurationMs(this.twoFactorStepTtl, 'TWO_FACTOR_STEP_TTL');
  }

  getTwoFactorStepTtlMs(): number {
    return this.twoFactorStepTtlMs;
  }

  async issueTokens(user: AuthUserRecord, meta: RequestMeta): Promise<IssuedTokens> {
    const refreshTokenId = randomUUID();
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      jti: refreshTokenId,
      type: 'refresh',
    };

    // Keep JWT claims minimal to avoid leaking tenant/role/security-sensitive data.
    const accessPayload: AccessTokenPayload = {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      isTwoFactorAuthenticated: true,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.accessSecret,
        expiresIn: this.accessTtl,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtl,
      }),
    ]);

    await this.refreshTokensRepository.create({
      jti: refreshTokenId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + this.refreshTtlMs),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      user: { connect: { id: user.id } },
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenId,
      accessExpiresInSeconds: Math.floor(this.accessTtlMs / 1000),
    };
  }

  async issueTwoFactorPendingToken(user: AuthUserRecord): Promise<TwoFactorPendingToken> {
    // The JWT payload intentionally stays minimal to reduce impact if compromised.
    const payload: AccessTokenPayload = {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      isTwoFactorAuthenticated: false,
    };

    // This token is short-lived because it only represents step-1 authentication.
    const token = await this.jwtService.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.twoFactorStepTtl,
    });

    return {
      token,
      expiresInSeconds: Math.floor(this.twoFactorStepTtlMs / 1000),
    };
  }

  async issueMagicLinkToken(payload: MagicLinkPayload): Promise<IssuedMagicLinkToken> {
    const token = await this.jwtService.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.magicLinkTtl,
    });

    return {
      token,
      expiresAt: new Date(Date.now() + this.magicLinkTtlMs),
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.accessSecret,
      });

      if (!payload.userId || !payload.email || !payload.tenantId) {
        throw new UnauthorizedException('Invalid authentication credentials.');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid authentication credentials.');
    }
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.refreshSecret,
      });

      if (!payload.sub || !payload.jti || payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid authentication credentials.');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid authentication credentials.');
    }
  }

  async verifyMagicLinkToken(token: string): Promise<MagicLinkPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<MagicLinkPayload>(token, {
        secret: this.accessSecret,
      });

      if (
        payload.type !== 'magic-link' ||
        !payload.userId ||
        !payload.email ||
        !payload.jti
      ) {
        throw new UnauthorizedException('Invalid authentication credentials.');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid authentication credentials.');
    }
  }

  private parseDurationMs(value: string, envName: string): number {
    const parsed = ms(value as never);

    if (typeof parsed !== 'number' || Number.isNaN(parsed) || parsed <= 0) {
      throw new InternalServerErrorException(`${envName} has an invalid duration.`);
    }

    return parsed;
  }
}
