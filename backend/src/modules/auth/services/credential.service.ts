import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, Prisma, type Role, type Tenant } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { RequestMeta } from '../../../common/interfaces/request-meta.interface';
import {
  hashToken,
  isValidPhone,
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
  sanitizeString,
} from '../../../common/utils/security.util';
import { RolesRepository } from '../../roles/repositories/roles.repository';
import { TenantsRepository } from '../../tenants/repositories/tenants.repository';
import { type AuthUserRecord, UsersRepository } from '../../users/repositories/users.repository';
import type {
  AuthResponseDto,
  LoginTwoFactorChallengeResponseDto,
  RequestMagicLinkResponseDto,
} from '../dto/auth-response.dto';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { RequestMagicLinkDto } from '../dto/request-magic-link.dto';
import { VerifyMagicLinkDto } from '../dto/verify-magic-link.dto';
import { EMAIL_GATEWAY, type EmailGateway } from '../providers/email-gateway.interface';
import {
  type GoogleIdentity,
  GoogleTokenVerifierService,
} from '../providers/google-token-verifier.service';
import { MagicLinkTokensRepository } from '../repositories/magic-link-tokens.repository';
import { AuthAttemptService } from './auth-attempt.service';
import {
  COMPROMISED_PASSWORD_CHECKER,
  type CompromisedPasswordChecker,
} from './hibp-password-checker.service';
import { SessionService } from './session.service';
import { type MagicLinkPayload, TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';
import type { GoogleOAuthUser } from '../strategies/google.strategy';

type RegisterConflictReason = 'email_conflict' | 'phone_conflict' | 'identifier_conflict';

const REGISTER_CONFLICT_MESSAGE = 'Unable to create account with provided information.';

@Injectable()
export class CredentialService {
  private readonly logger = new Logger('AuthService');
  private readonly magicLinkCallbackUrl: string;
  private readonly bcryptSaltRounds: number;
  private readonly otpMaxAttempts: number;
  private readonly defaultTenantName: string;
  private readonly defaultTenantDomain: string;
  private readonly defaultSignupRoleName: string;
  private readonly registerMinResponseMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersRepository: UsersRepository,
    private readonly tenantsRepository: TenantsRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly magicLinkTokensRepository: MagicLinkTokensRepository,
    private readonly googleTokenVerifierService: GoogleTokenVerifierService,
    private readonly authAttemptService: AuthAttemptService,
    @Inject(COMPROMISED_PASSWORD_CHECKER)
    private readonly compromisedPasswordChecker: CompromisedPasswordChecker,
    @Inject(EMAIL_GATEWAY) private readonly emailGateway: EmailGateway,
    private readonly tokenService: TokenService,
    private readonly twoFactorService: TwoFactorService,
    private readonly sessionService: SessionService,
  ) {
    this.magicLinkCallbackUrl = this.configService.getOrThrow<string>('MAGIC_LINK_CALLBACK_URL');
    this.bcryptSaltRounds = this.configService.getOrThrow<number>('BCRYPT_SALT_ROUNDS');
    this.otpMaxAttempts = this.configService.getOrThrow<number>('OTP_MAX_ATTEMPTS');
    this.defaultTenantName = this.configService.getOrThrow<string>('DEFAULT_TENANT_NAME');
    this.defaultTenantDomain = this.configService.getOrThrow<string>('DEFAULT_TENANT_DOMAIN');
    this.defaultSignupRoleName = this.configService.getOrThrow<string>('DEFAULT_SIGNUP_ROLE_NAME');
    this.registerMinResponseMs = this.configService.getOrThrow<number>('REGISTER_MIN_RESPONSE_MS');
  }

  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResponseDto> {
    const startedAt = Date.now();
    const normalizedEmail = normalizeEmail(dto.email);
    const normalizedPhone = dto.phoneNumber ? normalizePhone(dto.phoneNumber) : undefined;
    const attemptKey = `register:${meta.ipAddress ?? 'unknown'}:${normalizedEmail}`;
    await this.authAttemptService.assertWithinLimit(attemptKey, 5, 15 * 60_000);

    if (normalizedPhone && !isValidPhone(normalizedPhone)) {
      throw new BadRequestException('Invalid phone number format.');
    }

    await this.assertPasswordIsAllowed(dto.password);
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptSaltRounds);
    const [existingByEmail, existingByPhone] = await Promise.all([
      this.usersRepository.findAuthByEmail(normalizedEmail),
      normalizedPhone ? this.usersRepository.findAuthByPhoneNumber(normalizedPhone) : null,
    ]);

    if (existingByEmail) {
      return this.throwRegisterConflict({
        reason: 'email_conflict',
        attemptKey,
        normalizedEmail,
        normalizedPhone,
        meta,
        startedAt,
      });
    }

    if (existingByPhone) {
      return this.throwRegisterConflict({
        reason: 'phone_conflict',
        attemptKey,
        normalizedEmail,
        normalizedPhone,
        meta,
        startedAt,
      });
    }

    const { tenant, role } = await this.getOrCreateSignupTenantAndRole({
      tenantName: dto.tenantName ?? dto.company,
    });

    let createdUser: AuthUserRecord;
    try {
      createdUser = await this.usersRepository.create({
        name: this.resolveRegistrationName(dto),
        email: normalizedEmail,
        phoneNumber: normalizedPhone ?? null,
        passwordHash,
        provider: AuthProvider.LOCAL,
        tenant: { connect: { id: tenant.id } },
        role: { connect: { id: role.id } },
      });
    } catch (error) {
      if (this.isRegisterIdentityConstraintViolation(error)) {
        const target = this.extractPrismaConstraintTargets(error);
        const reason: RegisterConflictReason = target.includes('email')
          ? 'email_conflict'
          : target.includes('phoneNumber')
            ? 'phone_conflict'
            : 'identifier_conflict';

        return this.throwRegisterConflict({
          reason,
          attemptKey,
          normalizedEmail,
          normalizedPhone,
          meta,
          startedAt,
          target,
        });
      }

      throw error;
    }

    await this.authAttemptService.reset(attemptKey);
    const tokens = await this.tokenService.issueTokens(createdUser, meta);
    await this.ensureRegisterMinimumResponseTime(startedAt);
    return this.sessionService.toAuthResponse(createdUser, tokens, dto.redirectTo);
  }

  async login(
    dto: LoginDto,
    meta: RequestMeta,
  ): Promise<AuthResponseDto | LoginTwoFactorChallengeResponseDto> {
    const { user, key } = await this.findUserByLoginIdentifier(dto);
    const attemptKey = `login:${meta.ipAddress ?? 'unknown'}:${key}`;
    await this.authAttemptService.assertWithinLimit(attemptKey, 5, 15 * 60_000);
    if (!user?.passwordHash) {
      await this.authAttemptService.recordFailure(attemptKey, 15 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      await this.authAttemptService.recordFailure(attemptKey, 15 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    await this.authAttemptService.reset(attemptKey);

    if (user.isTwoFactorEnabled) {
      return this.twoFactorService.createTwoFactorChallenge(user, dto.redirectTo);
    }

    const tokens = await this.tokenService.issueTokens(user, meta);
    return this.sessionService.toAuthResponse(user, tokens, dto.redirectTo);
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
    await this.authAttemptService.assertWithinLimit(attemptKey, 8, 15 * 60_000);

    const user = await this.getOrCreateMagicLinkUser(normalizedEmail);
    const jti = randomUUID();
    const payload: MagicLinkPayload = {
      userId: user.id,
      email: user.email,
      jti,
      type: 'magic-link',
      redirectTo: dto.redirectTo,
    };

    const issued = await this.tokenService.issueMagicLinkToken(payload);

    await this.magicLinkTokensRepository.create({
      jti,
      tokenHash: hashToken(issued.token),
      expiresAt: issued.expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      user: { connect: { id: user.id } },
    });

    try {
      await this.emailGateway.sendMagicLink(
        user.email,
        this.buildMagicLinkUrl(issued.token),
        issued.expiresAt,
      );
    } catch {
      throw new InternalServerErrorException('Unable to send magic link.');
    }

    await this.authAttemptService.reset(attemptKey);
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
    await this.authAttemptService.assertWithinLimit(attemptKey, this.otpMaxAttempts, 10 * 60_000);

    const payload = await this.tokenService.verifyMagicLinkToken(dto.token);
    const persistedToken = await this.magicLinkTokensRepository.findByJti(payload.jti);

    const isTokenInvalid =
      !persistedToken ||
      persistedToken.userId !== payload.userId ||
      persistedToken.tokenHash !== hashToken(dto.token) ||
      persistedToken.consumedAt !== null ||
      persistedToken.expiresAt.getTime() <= Date.now();
    if (isTokenInvalid) {
      await this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    // Atomic consume prevents token replay in concurrent requests.
    const consumed = await this.magicLinkTokensRepository.consumeIfActive(persistedToken.id);
    if (!consumed) {
      await this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    const user = await this.usersRepository.findAuthById(payload.userId);
    if (!user) {
      await this.authAttemptService.recordFailure(attemptKey, 10 * 60_000);
      throw new UnauthorizedException('Invalid authentication credentials.');
    }

    await this.authAttemptService.reset(attemptKey);
    const redirectTo = dto.redirectTo ?? payload.redirectTo;

    if (user.isTwoFactorEnabled) {
      return this.twoFactorService.createTwoFactorChallenge(user, redirectTo);
    }

    const tokens = await this.tokenService.issueTokens(user, meta);
    return this.sessionService.toAuthResponse(user, tokens, redirectTo);
  }

  private async authenticateGoogleIdentity(
    identity: GoogleIdentity,
    meta: RequestMeta,
    redirectTo?: string,
  ): Promise<AuthResponseDto | LoginTwoFactorChallengeResponseDto> {
    const user = await this.upsertGoogleUser(identity);

    if (user.isTwoFactorEnabled) {
      return this.twoFactorService.createTwoFactorChallenge(user, redirectTo);
    }

    const tokens = await this.tokenService.issueTokens(user, meta);
    return this.sessionService.toAuthResponse(user, tokens, redirectTo);
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

    const { tenant, role } = await this.getOrCreateSignupTenantAndRole();
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

    const { tenant, role } = await this.getOrCreateSignupTenantAndRole();
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

  private async getOrCreateSignupTenantAndRole(params: {
    tenantName?: string;
  } = {}): Promise<{ tenant: Tenant; role: Role }> {
    const tenant = await this.getOrCreateTenant({
      tenantName: params.tenantName,
    });
    const role = await this.getOrCreateRoleInTenant(tenant.id, this.defaultSignupRoleName, []);

    return {
      tenant,
      role,
    };
  }

  private async getOrCreateTenant(params: {
    tenantName?: string;
    tenantDomain?: string;
  }): Promise<Tenant> {
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

    return tenant;
  }

  private async getOrCreateRoleInTenant(
    tenantId: string,
    roleName: string,
    defaultPermissions: string[],
  ): Promise<Role> {
    const normalizedRoleName = sanitizeString(roleName).toLowerCase() || this.defaultSignupRoleName;
    let role = await this.rolesRepository.findByNameInTenant(tenantId, normalizedRoleName);

    if (!role) {
      role = await this.rolesRepository.create({
        name: normalizedRoleName,
        permissions: defaultPermissions,
        tenant: { connect: { id: tenantId } },
      });
    }

    return role;
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

  private async throwRegisterConflict(params: {
    reason: RegisterConflictReason;
    attemptKey: string;
    normalizedEmail: string;
    normalizedPhone?: string;
    meta: RequestMeta;
    startedAt: number;
    target?: string[];
  }): Promise<never> {
    await this.authAttemptService.recordFailure(params.attemptKey, 15 * 60_000);
    this.logger.warn(
      `register_conflict reason=${params.reason} requestId=${params.meta.requestId ?? 'n/a'} ip=${params.meta.ipAddress ?? 'n/a'} emailHash=${this.maskIdentifierForLog(params.normalizedEmail)} phoneHash=${params.normalizedPhone ? this.maskIdentifierForLog(params.normalizedPhone) : 'n/a'} prismaTarget=${params.target?.join(',') ?? 'n/a'}`,
    );
    await this.ensureRegisterMinimumResponseTime(params.startedAt);
    throw new ConflictException(REGISTER_CONFLICT_MESSAGE);
  }

  private isRegisterIdentityConstraintViolation(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return false;
    }

    const targets = this.extractPrismaConstraintTargets(error);
    return targets.includes('email') || targets.includes('phoneNumber');
  }

  private extractPrismaConstraintTargets(error: Prisma.PrismaClientKnownRequestError): string[] {
    const target = (error.meta as { target?: unknown } | undefined)?.target;
    if (!Array.isArray(target)) {
      return [];
    }
    return target.map((value) => String(value));
  }

  private maskIdentifierForLog(value: string): string {
    return hashToken(value).slice(0, 12);
  }

  private async ensureRegisterMinimumResponseTime(startedAt: number): Promise<void> {
    const elapsedMs = Date.now() - startedAt;
    const remainingMs = this.registerMinResponseMs - elapsedMs;
    if (remainingMs > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, remainingMs);
      });
    }
  }

  private async assertPasswordIsAllowed(password: string): Promise<void> {
    const result = await this.compromisedPasswordChecker.check(password);

    if (result.compromised) {
      throw new BadRequestException(
        'Password has been exposed in known data breaches. Please choose a different password.',
      );
    }
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

  private buildMagicLinkUrl(token: string): string {
    const callback = new URL(this.magicLinkCallbackUrl);
    callback.searchParams.set('token', token);
    return callback.toString();
  }
}
