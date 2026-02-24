import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, Prisma, type Role, type Tenant } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import ms from 'ms';
import {
  type AccessTokenPayload,
  type RefreshTokenPayload,
} from '../../common/interfaces/jwt-payload.interface';
import type { RequestMeta } from '../../common/interfaces/request-meta.interface';
import {
  decryptSecret,
  encryptSecret,
  hashToken,
  isValidPhone,
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
  resolveRedirect,
  sanitizeString,
  splitName,
} from '../../common/utils/security.util';
import { RolesRepository } from '../roles/repositories/roles.repository';
import { TenantsRepository } from '../tenants/repositories/tenants.repository';
import {
  type AuthUserRecord,
  type PublicUserRecord,
  UsersRepository,
} from '../users/repositories/users.repository';
import {
  type AuthResponseDto,
  type AuthUserResponseDto,
  type LoginTwoFactorChallengeResponseDto,
  type RequestMagicLinkResponseDto,
  type SetupTwoFactorResponseDto,
} from './dto/auth-response.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestMagicLinkDto } from './dto/request-magic-link.dto';
import { VerifyLoginTwoFactorDto } from './dto/verify-login-2fa.dto';
import { VerifyMagicLinkDto } from './dto/verify-magic-link.dto';
import { EMAIL_GATEWAY, type EmailGateway } from './providers/email-gateway.interface';
import {
  type GoogleIdentity,
  GoogleTokenVerifierService,
} from './providers/google-token-verifier.service';
import { MagicLinkTokensRepository } from './repositories/magic-link-tokens.repository';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { AuthAttemptService } from './services/auth-attempt.service';
import type { GoogleOAuthUser } from './strategies/google.strategy';

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
  accessExpiresInSeconds: number;
}

interface TwoFactorPendingToken {
  token: string;
  expiresInSeconds: number;
}

interface MagicLinkPayload {
  userId: string;
  email: string;
  jti: string;
  type: 'magic-link';
  redirectTo?: string;
}

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
export class AuthService {
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
  private readonly dashboardRedirectUrl: string;
  private readonly magicLinkCallbackUrl: string;
  private readonly twoFactorEncryptionKey: string;
  private readonly totpIssuer: string;
  private readonly bcryptSaltRounds: number;
  private readonly otpMaxAttempts: number;
  private readonly defaultTenantName: string;
  private readonly defaultTenantDomain: string;
  private readonly defaultRoleName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersRepository: UsersRepository,
    private readonly tenantsRepository: TenantsRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly magicLinkTokensRepository: MagicLinkTokensRepository,
    private readonly googleTokenVerifierService: GoogleTokenVerifierService,
    private readonly authAttemptService: AuthAttemptService,
    @Inject(EMAIL_GATEWAY) private readonly emailGateway: EmailGateway,
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
    this.dashboardRedirectUrl = this.configService.getOrThrow<string>('DASHBOARD_REDIRECT_URL');
    this.magicLinkCallbackUrl = this.configService.getOrThrow<string>('MAGIC_LINK_CALLBACK_URL');
    this.twoFactorEncryptionKey = this.configService.getOrThrow<string>('TWO_FACTOR_ENCRYPTION_KEY');
    this.totpIssuer = this.configService.get<string>('TOTP_ISSUER') ?? 'RFID SaaS';
    this.bcryptSaltRounds = this.configService.getOrThrow<number>('BCRYPT_SALT_ROUNDS');
    this.otpMaxAttempts = this.configService.getOrThrow<number>('OTP_MAX_ATTEMPTS');
    this.defaultTenantName = this.configService.getOrThrow<string>('DEFAULT_TENANT_NAME');
    this.defaultTenantDomain = this.configService.getOrThrow<string>('DEFAULT_TENANT_DOMAIN');
    this.defaultRoleName = this.configService.getOrThrow<string>('DEFAULT_ROLE_NAME');

    authenticator.options = {
      step: 30,
      window: 1,
    };
  }

  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResponseDto> {
    const normalizedEmail = normalizeEmail(dto.email);
    const attemptKey = `register:${meta.ipAddress ?? 'unknown'}:${normalizedEmail}`;
    this.authAttemptService.assertWithinLimit(attemptKey, 5, 15 * 60_000);

    const normalizedPhone = dto.phoneNumber ? normalizePhone(dto.phoneNumber) : undefined;
    if (normalizedPhone && !isValidPhone(normalizedPhone)) {
      throw new BadRequestException('Invalid phone number format.');
    }

    const [existingByEmail, existingByPhone] = await Promise.all([
      this.usersRepository.findAuthByEmail(normalizedEmail),
      normalizedPhone ? this.usersRepository.findAuthByPhoneNumber(normalizedPhone) : null,
    ]);

    if (existingByEmail) {
      this.authAttemptService.recordFailure(attemptKey, 15 * 60_000);
      throw new ConflictException('Email already exists.');
    }

    if (existingByPhone) {
      this.authAttemptService.recordFailure(attemptKey, 15 * 60_000);
      throw new ConflictException('Phone number already exists.');
    }

    const { tenant, role } = await this.getOrCreateTenantAndRole({
      tenantName: dto.tenantName ?? dto.company,
      tenantDomain: dto.tenantDomain,
      roleName: dto.roleName,
    });

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptSaltRounds);
    const createdUser = await this.usersRepository.create({
      name: this.resolveRegistrationName(dto),
      email: normalizedEmail,
      phoneNumber: normalizedPhone ?? null,
      passwordHash,
      provider: AuthProvider.LOCAL,
      tenant: { connect: { id: tenant.id } },
      role: { connect: { id: role.id } },
    });

    this.authAttemptService.reset(attemptKey);
    const tokens = await this.issueTokens(createdUser, meta);
    return this.toAuthResponse(createdUser, tokens, dto.redirectTo);
  }

  async login(
    dto: LoginDto,
    meta: RequestMeta,
  ): Promise<AuthResponseDto | LoginTwoFactorChallengeResponseDto> {
    const { user, key } = await this.findUserByLoginIdentifier(dto);
    const attemptKey = `login:${meta.ipAddress ?? 'unknown'}:${key}`;
    this.authAttemptService.assertWithinLimit(attemptKey, 5, 15 * 60_000);
    if (!user?.passwordHash) {
      this.authAttemptService.recordFailure(attemptKey, 15 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      this.authAttemptService.recordFailure(attemptKey, 15 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    this.authAttemptService.reset(attemptKey);

    if (user.isTwoFactorEnabled) {
      return this.createTwoFactorChallenge(user, dto.redirectTo);
    }

    const tokens = await this.issueTokens(user, meta);
    return this.toAuthResponse(user, tokens, dto.redirectTo);
  }

  async verifyLoginTwoFactor(
    dto: VerifyLoginTwoFactorDto,
    meta: RequestMeta,
  ): Promise<AuthResponseDto> {
    const attemptKey = `2fa-login:${meta.ipAddress ?? 'unknown'}`;
    this.authAttemptService.assertWithinLimit(attemptKey, this.otpMaxAttempts, 10 * 60_000);

    const payload = await this.verifyAccessToken(dto.twoFactorToken);
    if (payload.isTwoFactorAuthenticated) {
      throw new BadRequestException('Token is already fully authenticated.');
    }

    const user = await this.usersRepository.findAuthById(payload.userId);
    if (!user || !user.isTwoFactorEnabled) {
      this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Two-factor verification failed.');
    }

    const secret = this.readTwoFactorSecret(user);
    const isValidCode = authenticator.check(dto.code, secret);
    if (!isValidCode) {
      this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Two-factor verification failed.');
    }

    this.authAttemptService.reset(attemptKey);
    const tokens = await this.issueTokens(user, meta);
    return this.toAuthResponse(user, tokens, dto.redirectTo);
  }

  async googleOAuthCallback(
    profile: GoogleOAuthUser,
    meta: RequestMeta,
    redirectTo?: string,
  ): Promise<AuthResponseDto | LoginTwoFactorChallengeResponseDto> {
    return this.authenticateGoogleIdentity(
      {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
      },
      meta,
      redirectTo ?? profile.redirectTo,
    );
  }

  async googleLogin(
    dto: GoogleLoginDto,
    meta: RequestMeta,
  ): Promise<AuthResponseDto | LoginTwoFactorChallengeResponseDto> {
    const identity = await this.googleTokenVerifierService.verifyIdToken(dto.idToken);
    return this.authenticateGoogleIdentity(identity, meta, dto.redirectTo);
  }

  async requestMagicLink(
    dto: RequestMagicLinkDto,
    meta: RequestMeta,
  ): Promise<RequestMagicLinkResponseDto> {
    const normalizedEmail = normalizeEmail(dto.email);
    const attemptKey = `magic-link:${meta.ipAddress ?? 'unknown'}:${normalizedEmail}`;
    this.authAttemptService.assertWithinLimit(attemptKey, 8, 15 * 60_000);

    const user = await this.getOrCreateMagicLinkUser(normalizedEmail);
    const jti = randomUUID();
    const payload: MagicLinkPayload = {
      userId: user.id,
      email: user.email,
      jti,
      type: 'magic-link',
      redirectTo: dto.redirectTo,
    };

    const token = await this.jwtService.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.magicLinkTtl,
    });
    const expiresAt = new Date(Date.now() + this.magicLinkTtlMs);

    await this.magicLinkTokensRepository.create({
      jti,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      user: { connect: { id: user.id } },
    });

    try {
      await this.emailGateway.sendMagicLink(
        user.email,
        this.buildMagicLinkUrl(token),
        expiresAt,
      );
    } catch {
      throw new InternalServerErrorException('Unable to send magic link.');
    }

    this.authAttemptService.reset(attemptKey);
    return {
      success: true,
      message: 'If the email is valid, a magic link has been sent.',
    };
  }

  async verifyMagicLink(
    dto: VerifyMagicLinkDto,
    meta: RequestMeta,
  ): Promise<AuthResponseDto | LoginTwoFactorChallengeResponseDto> {
    const attemptKey = `magic-link-verify:${meta.ipAddress ?? 'unknown'}`;
    this.authAttemptService.assertWithinLimit(attemptKey, this.otpMaxAttempts, 10 * 60_000);

    const payload = await this.verifyMagicLinkToken(dto.token);
    const persistedToken = await this.magicLinkTokensRepository.findByJti(payload.jti);

    const isTokenInvalid =
      !persistedToken ||
      persistedToken.userId !== payload.userId ||
      persistedToken.tokenHash !== hashToken(dto.token) ||
      persistedToken.consumedAt !== null ||
      persistedToken.expiresAt.getTime() <= Date.now();
    if (isTokenInvalid) {
      this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    // Atomic consume prevents token replay in concurrent requests.
    const consumed = await this.magicLinkTokensRepository.consumeIfActive(persistedToken.id);
    if (!consumed) {
      this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    const user = await this.usersRepository.findAuthById(payload.userId);
    if (!user) {
      this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    this.authAttemptService.reset(attemptKey);
    const redirectTo = dto.redirectTo ?? payload.redirectTo;

    if (user.isTwoFactorEnabled) {
      return this.createTwoFactorChallenge(user, redirectTo);
    }

    const tokens = await this.issueTokens(user, meta);
    return this.toAuthResponse(user, tokens, redirectTo);
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

  async refresh(dto: RefreshTokenDto, meta: RequestMeta): Promise<AuthResponseDto> {
    const attemptKey = `refresh:${meta.ipAddress ?? 'unknown'}`;
    this.authAttemptService.assertWithinLimit(attemptKey, 10, 10 * 60_000);

    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const persistedToken = await this.refreshTokensRepository.findByJti(payload.jti);
    const isInvalid =
      !persistedToken ||
      persistedToken.userId !== payload.sub ||
      persistedToken.revokedAt !== null ||
      persistedToken.expiresAt.getTime() <= Date.now();

    if (isInvalid) {
      this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    if (persistedToken.tokenHash !== hashToken(dto.refreshToken)) {
      await this.refreshTokensRepository.revokeById(persistedToken.id).catch(() => undefined);
      this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    const user = await this.usersRepository.findAuthById(payload.sub);
    if (!user) {
      this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    const tokens = await this.issueTokens(user, meta);
    await this.refreshTokensRepository.revokeById(
      persistedToken.id,
      tokens.refreshTokenId,
    );

    this.authAttemptService.reset(attemptKey);
    return this.toAuthResponse(user, tokens);
  }

  async logout(userId: string, dto: LogoutDto): Promise<{ success: true }> {
    if (!dto.refreshToken) {
      await this.refreshTokensRepository.revokeByUserId(userId);
      return { success: true };
    }

    try {
      const payload = await this.verifyRefreshToken(dto.refreshToken);
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

  private async authenticateGoogleIdentity(
    identity: GoogleIdentity,
    meta: RequestMeta,
    redirectTo?: string,
  ): Promise<AuthResponseDto | LoginTwoFactorChallengeResponseDto> {
    const user = await this.upsertGoogleUser(identity);

    if (user.isTwoFactorEnabled) {
      return this.createTwoFactorChallenge(user, redirectTo);
    }

    const tokens = await this.issueTokens(user, meta);
    return this.toAuthResponse(user, tokens, redirectTo);
  }

  private async upsertGoogleUser(identity: GoogleIdentity): Promise<AuthUserRecord> {
    const normalizedEmail = normalizeEmail(identity.email);
    const normalizedName = sanitizeString(identity.name) || 'Google User';

    const byGoogleId = await this.usersRepository.findAuthByGoogleId(identity.googleId);
    if (byGoogleId) {
      if (byGoogleId.email !== normalizedEmail) {
        const byEmail = await this.usersRepository.findAuthByEmail(normalizedEmail);
        if (byEmail && byEmail.id !== byGoogleId.id) {
          throw new ConflictException('Unable to link this Google account.');
        }
      }

      return this.usersRepository.updateById(byGoogleId.id, {
        email: normalizedEmail,
        name: normalizedName,
        provider: AuthProvider.GOOGLE,
      });
    }

    const byEmail = await this.usersRepository.findAuthByEmail(normalizedEmail);
    if (byEmail) {
      return this.usersRepository.updateById(byEmail.id, {
        googleId: identity.googleId,
        provider: AuthProvider.GOOGLE,
        name: normalizedName,
      });
    }

    const { tenant, role } = await this.getOrCreateTenantAndRole({});
    return this.usersRepository.create({
      name: normalizedName,
      email: normalizedEmail,
      googleId: identity.googleId,
      provider: AuthProvider.GOOGLE,
      tenant: { connect: { id: tenant.id } },
      role: { connect: { id: role.id } },
    });
  }

  private async getOrCreateMagicLinkUser(email: string): Promise<AuthUserRecord> {
    const existing = await this.usersRepository.findAuthByEmail(email);
    if (existing) {
      return existing;
    }

    const { tenant, role } = await this.getOrCreateTenantAndRole({});
    const fallbackName = this.resolveNameFromEmail(email);

    try {
      return await this.usersRepository.create({
        name: fallbackName,
        email,
        provider: AuthProvider.MAGIC_LINK,
        tenant: { connect: { id: tenant.id } },
        role: { connect: { id: role.id } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const user = await this.usersRepository.findAuthByEmail(email);
        if (user) {
          return user;
        }
      }

      throw error;
    }
  }

  private async getOrCreateTenantAndRole(params: {
    tenantName?: string;
    tenantDomain?: string;
    roleName?: string;
  }): Promise<{ tenant: Tenant; role: Role }> {
    const tenantDomain = normalizeDomain(params.tenantDomain ?? this.defaultTenantDomain);
    const tenantName =
      sanitizeString(params.tenantName ?? this.defaultTenantName) || this.defaultTenantName;
    let tenant = await this.tenantsRepository.findByDomain(tenantDomain);

    if (!tenant) {
      tenant = await this.tenantsRepository.create({
        name: tenantName,
        domain: tenantDomain,
      });
    }

    const roleName =
      sanitizeString(params.roleName ?? this.defaultRoleName).toLowerCase() ||
      this.defaultRoleName;
    let role = await this.rolesRepository.findByNameInTenant(tenant.id, roleName);

    if (!role) {
      role = await this.rolesRepository.create({
        name: roleName,
        permissions: ['*'],
        tenant: { connect: { id: tenant.id } },
      });
    }

    return {
      tenant,
      role,
    };
  }

  private async createTwoFactorChallenge(
    user: AuthUserRecord,
    redirectTo?: string,
  ): Promise<LoginTwoFactorChallengeResponseDto> {
    const pendingToken = await this.issueTwoFactorPendingToken(user);
    const expiresAt = new Date(Date.now() + this.twoFactorStepTtlMs).toISOString();

    return {
      requiresTwoFactor: true,
      twoFactorToken: pendingToken.token,
      expiresIn: pendingToken.expiresInSeconds,
      expiresAt,
      redirectTo: this.resolveDashboardRedirect(redirectTo),
      user: {
        id: user.id,
        email: user.email,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      },
    };
  }

  private async issueTwoFactorPendingToken(user: AuthUserRecord): Promise<TwoFactorPendingToken> {
    // The JWT payload intentionally stays minimal to reduce impact if compromised.
    const payload: AccessTokenPayload = {
      userId: user.id,
      email: user.email,
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

  private async issueTokens(user: AuthUserRecord, meta: RequestMeta): Promise<IssuedTokens> {
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

  private toAuthResponse(
    user: AuthUserRecord,
    tokens: IssuedTokens,
    redirectTo?: string,
  ): AuthResponseDto {
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

  private toUserResponse(user: PublicUserRecord | AuthUserRecord): AuthUserResponseDto {
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

  private resolveRegistrationName(dto: RegisterDto): string {
    if (dto.name) {
      return sanitizeString(dto.name);
    }

    const explicitName = `${dto.firstName ?? ''} ${dto.lastName ?? ''}`.trim();
    if (explicitName) {
      return sanitizeString(explicitName);
    }

    if (dto.company) {
      return sanitizeString(dto.company);
    }

    return this.resolveNameFromEmail(dto.email);
  }

  private resolveNameFromEmail(email: string): string {
    const localPart = sanitizeString(email.split('@')[0] ?? '').replace(/[._-]+/g, ' ').trim();
    return localPart || 'User';
  }

  private async findUserByLoginIdentifier(
    dto: LoginDto,
  ): Promise<{ user: AuthUserRecord | null; key: string }> {
    const identifier = sanitizeString(dto.identifier ?? '');
    const rawPhone = dto.phoneNumber ?? (identifier.includes('@') ? undefined : identifier);
    const normalizedPhone =
      rawPhone && isValidPhone(normalizePhone(rawPhone)) ? normalizePhone(rawPhone) : undefined;
    const rawEmail = dto.email ?? (identifier.includes('@') ? identifier : undefined);
    const normalizedEmail = rawEmail ? normalizeEmail(rawEmail) : undefined;

    if (!normalizedEmail && !normalizedPhone) {
      throw new BadRequestException('Email or phone number is required.');
    }

    const user = normalizedPhone
      ? await this.usersRepository.findAuthByPhoneNumber(normalizedPhone)
      : await this.usersRepository.findAuthByEmail(normalizedEmail!);

    return {
      user,
      key: normalizedEmail ?? normalizedPhone ?? 'unknown',
    };
  }

  private resolveDashboardRedirect(requestedPath?: string): string {
    return resolveRedirect(this.dashboardRedirectUrl, requestedPath);
  }

  private buildMagicLinkUrl(token: string): string {
    const callback = new URL(this.magicLinkCallbackUrl);
    callback.searchParams.set('token', token);
    return callback.toString();
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

  private async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.accessSecret,
      });

      if (!payload.userId || !payload.email) {
        throw new UnauthorizedException('Invalid authentication credentials.');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid authentication credentials.');
    }
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
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

  private async verifyMagicLinkToken(token: string): Promise<MagicLinkPayload> {
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
