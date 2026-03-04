import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RequestMeta } from '../../../common/interfaces/request-meta.interface';
import { hashToken, resolveRedirect, splitName } from '../../../common/utils/security.util';
import {
  type AuthUserRecord,
  type PublicUserRecord,
  UsersRepository,
} from '../../users/repositories/users.repository';
import type { AuthResponseDto, AuthUserResponseDto } from '../dto/auth-response.dto';
import { LogoutDto } from '../dto/logout.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import { AuthAttemptService } from './auth-attempt.service';
import { type IssuedTokens, TokenService } from './token.service';

@Injectable()
export class SessionService {
  private readonly dashboardRedirectUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly authAttemptService: AuthAttemptService,
    private readonly tokenService: TokenService,
  ) {
    this.dashboardRedirectUrl = this.configService.getOrThrow<string>('DASHBOARD_REDIRECT_URL');
  }

  async refresh(dto: RefreshTokenDto, meta: RequestMeta): Promise<AuthResponseDto> {
    if (!dto.refreshToken) {
      throw new BadRequestException('Refresh token is required.');
    }

    const attemptKey = `refresh:${meta.ipAddress ?? 'unknown'}`;
    await this.authAttemptService.assertWithinLimit(attemptKey, 10, 10 * 60_000);

    const payload = await this.tokenService.verifyRefreshToken(dto.refreshToken);
    const persistedToken = await this.refreshTokensRepository.findByJti(payload.jti);
    const isInvalid =
      !persistedToken ||
      persistedToken.userId !== payload.sub ||
      persistedToken.revokedAt !== null ||
      persistedToken.expiresAt.getTime() <= Date.now();

    if (isInvalid) {
      await this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    if (persistedToken.tokenHash !== hashToken(dto.refreshToken)) {
      await this.refreshTokensRepository.revokeById(persistedToken.id).catch(() => undefined);
      await this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    const user = await this.usersRepository.findAuthById(payload.sub);
    if (!user) {
      await this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    const tokens = await this.tokenService.issueTokens(user, meta);
    await this.refreshTokensRepository.revokeById(persistedToken.id, tokens.refreshTokenId);

    await this.authAttemptService.reset(attemptKey);
    return this.toAuthResponse(user, tokens);
  }

  async logout(userId: string, dto: LogoutDto): Promise<{ success: true }> {
    if (!dto.refreshToken) {
      await this.refreshTokensRepository.revokeByUserId(userId);
      return { success: true };
    }

    try {
      const payload = await this.tokenService.verifyRefreshToken(dto.refreshToken);
      const persistedToken = await this.refreshTokensRepository.findByJti(payload.jti);

      if (persistedToken && persistedToken.userId === userId && !persistedToken.revokedAt) {
        await this.refreshTokensRepository.revokeById(persistedToken.id);
      }
    } catch {
      // Keep logout endpoint idempotent and do not leak token validity details.
    }

    return { success: true };
  }

  async session(userId: string): Promise<AuthUserResponseDto> {
    const user = await this.usersRepository.findPublicById(userId);
    if (!user) {
      throw new UnauthorizedException('Session is invalid.');
    }

    return this.toUserResponse(user);
  }

  toAuthResponse(user: AuthUserRecord, tokens: IssuedTokens, redirectTo?: string): AuthResponseDto {
    const resolvedRedirect = this.resolveDashboardRedirect(redirectTo);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      token: tokens.accessToken,
      tokenType: 'Bearer',
      expiresIn: tokens.accessExpiresInSeconds,
      redirectTo: resolvedRedirect,
      user: this.toUserResponse(user),
    };
  }

  toUserResponse(user: PublicUserRecord | AuthUserRecord): AuthUserResponseDto {
    const { firstName, lastName } = splitName(user.name);

    return {
      id: user.id,
      name: user.name,
      firstName,
      lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      provider: user.provider,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
      company: user.tenant.name,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        domain: user.tenant.domain,
      },
      role: {
        id: user.role.id,
        name: user.role.name,
        permissions: user.role.permissions,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  resolveDashboardRedirect(requestedPath?: string): string {
    return resolveRedirect(this.dashboardRedirectUrl, requestedPath);
  }
}
