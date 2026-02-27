import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { RequestMeta } from '../../common/interfaces/request-meta.interface';
import { RolesRepository } from '../roles/repositories/roles.repository';
import { TenantsRepository } from '../tenants/repositories/tenants.repository';
import { UsersRepository } from '../users/repositories/users.repository';
import { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register.dto';
import type { EmailGateway } from './providers/email-gateway.interface';
import { GoogleTokenVerifierService } from './providers/google-token-verifier.service';
import { MagicLinkTokensRepository } from './repositories/magic-link-tokens.repository';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { AuthAttemptService } from './services/auth-attempt.service';
import type { CompromisedPasswordChecker } from './services/hibp-password-checker.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

type AnyMock = jest.Mock<any, any>;

interface UsersRepositoryMock {
  findAuthByEmail: AnyMock;
  findAuthByPhoneNumber: AnyMock;
  create: AnyMock;
  findAuthById: AnyMock;
  findAuthByGoogleId: AnyMock;
  updateById: AnyMock;
  findPublicById: AnyMock;
}

interface TenantsRepositoryMock {
  findByDomain: AnyMock;
  create: AnyMock;
}

interface RolesRepositoryMock {
  findByNameInTenant: AnyMock;
  create: AnyMock;
}

interface RefreshTokensRepositoryMock {
  create: AnyMock;
  findByJti: AnyMock;
  revokeById: AnyMock;
  revokeByUserId: AnyMock;
}

interface MagicLinkTokensRepositoryMock {
  create: AnyMock;
  findByJti: AnyMock;
  consumeIfActive: AnyMock;
}

interface GoogleTokenVerifierServiceMock {
  verifyIdToken: AnyMock;
}

interface AuthAttemptServiceMock {
  assertWithinLimit: AnyMock;
  recordFailure: AnyMock;
  reset: AnyMock;
}

interface EmailGatewayMock {
  sendMagicLink: AnyMock;
}

interface CompromisedPasswordCheckerMock {
  check: AnyMock;
}

interface AuthServiceTestContext {
  service: AuthService;
  usersRepository: UsersRepositoryMock;
  authAttemptService: AuthAttemptServiceMock;
  compromisedPasswordChecker: CompromisedPasswordCheckerMock;
}

const UNIFORM_REGISTER_CONFLICT_MESSAGE = 'Unable to create account with provided information.';

function createRegisterDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
  return {
    firstName: 'Alice',
    lastName: 'Martin',
    company: 'ACME',
    email: 'alice@example.com',
    password: 'StrongPass#123',
    ...overrides,
  };
}

function createMeta(): RequestMeta {
  return {
    requestId: 'req-security-test',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };
}

async function captureConflictError(promise: Promise<unknown>): Promise<ConflictException> {
  try {
    await promise;
    throw new Error('Expected register() to fail with ConflictException.');
  } catch (error) {
    expect(error).toBeInstanceOf(ConflictException);
    return error as ConflictException;
  }
}

function createAuthServiceTestContext(registerMinResponseMs = 0): AuthServiceTestContext {
  const configValues: Record<string, unknown> = {
    JWT_ACCESS_SECRET: 'a'.repeat(64),
    JWT_REFRESH_SECRET: 'b'.repeat(64),
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
    MAGIC_LINK_TTL: '15m',
    TWO_FACTOR_STEP_TTL: '5m',
    DASHBOARD_REDIRECT_URL: 'http://localhost:5173/dashboard/overview',
    MAGIC_LINK_CALLBACK_URL: 'http://localhost:5173/auth/magic-link/callback',
    TWO_FACTOR_ENCRYPTION_KEY:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    BCRYPT_SALT_ROUNDS: 12,
    OTP_MAX_ATTEMPTS: 5,
    DEFAULT_TENANT_NAME: 'Test Tenant',
    DEFAULT_TENANT_DOMAIN: 'test.local',
    DEFAULT_SIGNUP_ROLE_NAME: 'member',
    TOTP_ISSUER: 'RFID SaaS',
    REGISTER_MIN_RESPONSE_MS: registerMinResponseMs,
  };

  const configService = {
    getOrThrow: jest.fn((key: string) => {
      if (!(key in configValues)) {
        throw new Error(`Missing test config for key "${key}".`);
      }
      return configValues[key];
    }),
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('signed-token'),
    verifyAsync: jest.fn(),
  } as unknown as JwtService;

  const usersRepository: UsersRepositoryMock = {
    findAuthByEmail: jest.fn().mockResolvedValue(null),
    findAuthByPhoneNumber: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    findAuthById: jest.fn(),
    findAuthByGoogleId: jest.fn(),
    updateById: jest.fn(),
    findPublicById: jest.fn(),
  };

  const tenantsRepository: TenantsRepositoryMock = {
    findByDomain: jest.fn().mockResolvedValue({
      id: 'tenant-1',
      name: 'Test Tenant',
      domain: 'test.local',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
    create: jest.fn(),
  };

  const rolesRepository: RolesRepositoryMock = {
    findByNameInTenant: jest.fn().mockResolvedValue({
      id: 'role-member',
      tenantId: 'tenant-1',
      name: 'member',
      permissions: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
    create: jest.fn(),
  };

  const refreshTokensRepository: RefreshTokensRepositoryMock = {
    create: jest.fn(),
    findByJti: jest.fn(),
    revokeById: jest.fn(),
    revokeByUserId: jest.fn(),
  };

  const magicLinkTokensRepository: MagicLinkTokensRepositoryMock = {
    create: jest.fn(),
    findByJti: jest.fn(),
    consumeIfActive: jest.fn(),
  };

  const googleTokenVerifierService: GoogleTokenVerifierServiceMock = {
    verifyIdToken: jest.fn(),
  };

  const authAttemptService: AuthAttemptServiceMock = {
    assertWithinLimit: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
  };

  const emailGateway: EmailGatewayMock = {
    sendMagicLink: jest.fn().mockResolvedValue(undefined),
  };

  const compromisedPasswordChecker: CompromisedPasswordCheckerMock = {
    check: jest.fn().mockResolvedValue({
      compromised: false,
      breachCount: 0,
      provider: 'hibp-mock',
    }),
  };

  const service = new AuthService(
    configService,
    jwtService,
    usersRepository as unknown as UsersRepository,
    tenantsRepository as unknown as TenantsRepository,
    rolesRepository as unknown as RolesRepository,
    refreshTokensRepository as unknown as RefreshTokensRepository,
    magicLinkTokensRepository as unknown as MagicLinkTokensRepository,
    googleTokenVerifierService as unknown as GoogleTokenVerifierService,
    authAttemptService as unknown as AuthAttemptService,
    compromisedPasswordChecker as unknown as CompromisedPasswordChecker,
    emailGateway as unknown as EmailGateway,
  );

  return {
    service,
    usersRepository,
    authAttemptService,
    compromisedPasswordChecker,
  };
}

describe('AuthService register anti-enumeration', () => {
  beforeEach(() => {
    (bcrypt.hash as unknown as AnyMock).mockResolvedValue('hashed-password');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('returns the same HTTP status and message for existing email and existing phone', async () => {
    const context = createAuthServiceTestContext();
    context.usersRepository.findAuthByEmail
      .mockResolvedValueOnce({ id: 'existing-email-user' })
      .mockResolvedValueOnce(null);
    context.usersRepository.findAuthByPhoneNumber
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing-phone-user' });

    const meta = createMeta();
    const emailConflict = await captureConflictError(
      context.service.register(
        createRegisterDto({
          email: 'existing@example.com',
          phoneNumber: '+15550123456',
        }),
        meta,
      ),
    );
    const phoneConflict = await captureConflictError(
      context.service.register(
        createRegisterDto({
          email: 'new-address@example.com',
          phoneNumber: '+15550987654',
        }),
        meta,
      ),
    );

    expect(emailConflict.getStatus()).toBe(409);
    expect(phoneConflict.getStatus()).toBe(409);
    expect(phoneConflict.message).toBe(emailConflict.message);
    expect(phoneConflict.message).toBe(UNIFORM_REGISTER_CONFLICT_MESSAGE);
    expect(context.authAttemptService.recordFailure).toHaveBeenCalledTimes(2);
    expect(context.compromisedPasswordChecker.check).toHaveBeenCalledTimes(2);
  });

  it('rejects compromised passwords before hashing and user lookup', async () => {
    const context = createAuthServiceTestContext();
    context.compromisedPasswordChecker.check.mockResolvedValueOnce({
      compromised: true,
      breachCount: 42,
      provider: 'hibp-mock',
    });

    await expect(context.service.register(createRegisterDto(), createMeta())).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(context.compromisedPasswordChecker.check).toHaveBeenCalledWith('StrongPass#123');
    expect(bcrypt.hash as unknown as AnyMock).not.toHaveBeenCalled();
    expect(context.usersRepository.findAuthByEmail).not.toHaveBeenCalled();
  });

  it('maps Prisma unique collisions to the same uniform conflict response', async () => {
    const context = createAuthServiceTestContext();
    context.usersRepository.findAuthByEmail.mockResolvedValue(null);
    context.usersRepository.findAuthByPhoneNumber.mockResolvedValue(null);
    context.usersRepository.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed on email', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['email'] },
      }),
    );

    const conflict = await captureConflictError(
      context.service.register(
        createRegisterDto({
          email: 'race-condition@example.com',
          phoneNumber: '+15550666666',
        }),
        createMeta(),
      ),
    );

    expect(conflict.getStatus()).toBe(409);
    expect(conflict.message).toBe(UNIFORM_REGISTER_CONFLICT_MESSAGE);
    expect(context.authAttemptService.recordFailure).toHaveBeenCalledTimes(1);
  });

  it('enforces configured minimum response time on conflict paths', async () => {
    jest.useFakeTimers();
    const context = createAuthServiceTestContext(200);
    context.usersRepository.findAuthByEmail.mockResolvedValue({ id: 'existing-email-user' });

    const registerPromise = context.service.register(
      createRegisterDto({
        email: 'existing@example.com',
        phoneNumber: '+15550123456',
      }),
      createMeta(),
    );

    let settled = false;
    registerPromise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    await jest.advanceTimersByTimeAsync(0);

    await jest.advanceTimersByTimeAsync(199);
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    const conflict = await captureConflictError(registerPromise);

    expect(conflict.getStatus()).toBe(409);
    expect(conflict.message).toBe(UNIFORM_REGISTER_CONFLICT_MESSAGE);
    expect(bcrypt.hash as unknown as AnyMock).toHaveBeenCalledTimes(1);
  });
});
