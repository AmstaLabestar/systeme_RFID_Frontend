import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { type Role, type Tenant, type User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createServer, type Server } from 'http';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SanitizeBodyPipe } from '../src/common/pipes/sanitize-body.pipe';
import { sanitizeUnknown } from '../src/common/utils/security.util';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

function ensureE2eEnv(): void {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  process.env.PORT = process.env.PORT ?? '4012';
  process.env.TRUST_PROXY_HOPS = process.env.TRUST_PROXY_HOPS ?? '0';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/rfid_saas?schema=public';
  process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET ??
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ??
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '15m';
  process.env.JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? '7d';
  process.env.MAGIC_LINK_TTL = process.env.MAGIC_LINK_TTL ?? '15m';
  process.env.TWO_FACTOR_STEP_TTL = process.env.TWO_FACTOR_STEP_TTL ?? '5m';
  process.env.DASHBOARD_REDIRECT_URL =
    process.env.DASHBOARD_REDIRECT_URL ?? 'http://localhost:5173/dashboard/overview';
  process.env.CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:5173';
  process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS ?? '12';
  process.env.AUTH_ATTEMPT_REDIS_URL = process.env.AUTH_ATTEMPT_REDIS_URL ?? '';
  process.env.AUTH_ATTEMPT_REDIS_PREFIX =
    process.env.AUTH_ATTEMPT_REDIS_PREFIX ?? 'auth:attempt';
  process.env.AUTH_ATTEMPT_MAX_BUCKETS = process.env.AUTH_ATTEMPT_MAX_BUCKETS ?? '20000';
  process.env.AUTH_ATTEMPT_CLEANUP_INTERVAL_MS =
    process.env.AUTH_ATTEMPT_CLEANUP_INTERVAL_MS ?? '60000';
  process.env.DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME ?? 'RFID E2E Tenant';
  process.env.DEFAULT_TENANT_DOMAIN = process.env.DEFAULT_TENANT_DOMAIN ?? 'rfid-e2e.local';
  process.env.DEFAULT_ROLE_NAME = process.env.DEFAULT_ROLE_NAME ?? 'owner';
  process.env.DEFAULT_SIGNUP_ROLE_NAME = process.env.DEFAULT_SIGNUP_ROLE_NAME ?? 'member';
  process.env.OTP_MAX_ATTEMPTS = process.env.OTP_MAX_ATTEMPTS ?? '5';
  process.env.TOTP_ISSUER = process.env.TOTP_ISSUER ?? 'RFID SaaS';
  process.env.TWO_FACTOR_ENCRYPTION_KEY =
    process.env.TWO_FACTOR_ENCRYPTION_KEY ??
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? 'e2e.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? 'e2e-secret';
  process.env.GOOGLE_CALLBACK_URL =
    process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:4012/auth/google/callback';
  process.env.MAGIC_LINK_CALLBACK_URL =
    process.env.MAGIC_LINK_CALLBACK_URL ?? 'http://localhost:5173/auth/magic-link/callback';
  process.env.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER ?? 'console';
  process.env.EMAIL_FROM = process.env.EMAIL_FROM ?? 'no-reply@rfid-e2e.local';
}

function extractCookieValue(
  setCookies: string | string[] | undefined,
  cookieName: string,
): string | null {
  const cookieValues = Array.isArray(setCookies) ? setCookies : setCookies ? [setCookies] : [];
  if (cookieValues.length === 0) {
    return null;
  }

  const cookiePrefix = `${cookieName}=`;
  const cookieEntry = cookieValues.find((entry) => entry.startsWith(cookiePrefix));
  if (!cookieEntry) {
    return null;
  }

  const [cookiePair] = cookieEntry.split(';');
  if (!cookiePair) {
    return null;
  }

  return cookiePair.slice(cookiePrefix.length);
}

describe('Security hardening e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let tenant: Tenant;
  let fallbackTenant: Tenant;
  let adminRole: Role;
  let ownerRole: Role;
  let fallbackOwnerRole: Role;
  let memberRole: Role;
  let adminUser: User;
  let ownerUser: User;
  let fallbackOwnerUser: User;
  let memberUser: User;
  let cookieSessionUser: User;
  let memberPassword = '';
  let cookieSessionPassword = '';
  let adminAccessToken = '';

  beforeAll(async () => {
    ensureE2eEnv();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new SanitizeBodyPipe(),
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    tenant = await prisma.tenant.create({
      data: {
        name: 'E2E Security Tenant',
        domain: `e2e-security-${randomUUID().slice(0, 8)}.local`,
      },
    });

    fallbackTenant = await prisma.tenant.create({
      data: {
        name: 'E2E Security Fallback Tenant',
        domain: `e2e-security-fallback-${randomUUID().slice(0, 8)}.local`,
      },
    });

    adminRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: 'admin',
        permissions: ['*'],
      },
    });

    ownerRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: 'owner',
        permissions: ['unrelated.scope'],
      },
    });

    fallbackOwnerRole = await prisma.role.create({
      data: {
        tenantId: fallbackTenant.id,
        name: 'owner',
        permissions: [],
      },
    });

    memberRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: 'member',
        permissions: [],
      },
    });

    adminUser = await prisma.user.create({
      data: {
        name: 'Security Admin',
        email: `security-admin-${randomUUID().slice(0, 8)}@rfid-e2e.local`,
        roleId: adminRole.id,
        tenantId: tenant.id,
      },
    });

    ownerUser = await prisma.user.create({
      data: {
        name: 'Security Owner',
        email: `security-owner-${randomUUID().slice(0, 8)}@rfid-e2e.local`,
        roleId: ownerRole.id,
        tenantId: tenant.id,
      },
    });

    fallbackOwnerUser = await prisma.user.create({
      data: {
        name: 'Security Fallback Owner',
        email: `security-owner-fallback-${randomUUID().slice(0, 8)}@rfid-e2e.local`,
        roleId: fallbackOwnerRole.id,
        tenantId: fallbackTenant.id,
      },
    });

    memberPassword = 'StrongPass#123';
    const passwordHash = await bcrypt.hash(memberPassword, 12);
    memberUser = await prisma.user.create({
      data: {
        name: 'Security Member',
        email: `security-member-${randomUUID().slice(0, 8)}@rfid-e2e.local`,
        passwordHash,
        roleId: memberRole.id,
        tenantId: tenant.id,
      },
    });

    cookieSessionPassword = 'StrongPass#456';
    const cookieSessionPasswordHash = await bcrypt.hash(cookieSessionPassword, 12);
    cookieSessionUser = await prisma.user.create({
      data: {
        name: 'Security Session Member',
        email: `security-session-${randomUUID().slice(0, 8)}@rfid-e2e.local`,
        passwordHash: cookieSessionPasswordHash,
        roleId: memberRole.id,
        tenantId: tenant.id,
      },
    });

    adminAccessToken = await jwtService.signAsync(
      {
        userId: adminUser.id,
        email: adminUser.email,
        tenantId: adminUser.tenantId,
        isTwoFactorAuthenticated: true,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '30m',
      },
    );
  });

  afterAll(async () => {
    await prisma.adminActionLog.deleteMany({
      where: {
        actorId: {
          in: [adminUser?.id, ownerUser?.id, fallbackOwnerUser?.id, memberUser?.id, cookieSessionUser?.id].filter(
            (value): value is string => Boolean(value),
          ),
        },
      },
    });

    await prisma.webhookEndpoint.deleteMany({
      where: {
        tenantId: tenant?.id,
      },
    });

    await prisma.outboxEvent.deleteMany({
      where: {
        tenantId: tenant?.id,
      },
    });

    await prisma.refreshToken.deleteMany({
      where: {
        userId: {
          in: [adminUser?.id, ownerUser?.id, fallbackOwnerUser?.id, memberUser?.id, cookieSessionUser?.id].filter(
            (value): value is string => Boolean(value),
          ),
        },
      },
    });

    await prisma.magicLinkToken.deleteMany({
      where: {
        userId: {
          in: [adminUser?.id, ownerUser?.id, fallbackOwnerUser?.id, memberUser?.id, cookieSessionUser?.id].filter(
            (value): value is string => Boolean(value),
          ),
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [adminUser?.id, ownerUser?.id, fallbackOwnerUser?.id, memberUser?.id, cookieSessionUser?.id].filter(
            (value): value is string => Boolean(value),
          ),
        },
      },
    });

    await prisma.role.deleteMany({
      where: {
        id: {
          in: [adminRole?.id, ownerRole?.id, fallbackOwnerRole?.id, memberRole?.id].filter(
            (value): value is string => Boolean(value),
          ),
        },
      },
    });

    await prisma.tenant.deleteMany({
      where: {
        id: {
          in: [tenant?.id, fallbackTenant?.id].filter((value): value is string => Boolean(value)),
        },
      },
    });

    await app.close();
  });

  it('returns 429 after repeated failed login attempts', async () => {
    const payload = {
      identifier: memberUser.email,
      password: `${memberPassword}-wrong`,
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer()).post('/auth/signin').send(payload).expect(401);
    }

    await request(app.getHttpServer()).post('/auth/signin').send(payload).expect(429);
  });

  it('enforces permission scope even for allowed role names', async () => {
    const ownerTokenWithoutScope = await jwtService.signAsync(
      {
        userId: ownerUser.id,
        email: ownerUser.email,
        tenantId: ownerUser.tenantId,
        isTwoFactorAuthenticated: true,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '30m',
      },
    );

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${ownerTokenWithoutScope}`)
      .expect(403);
  });

  it('falls back to default owner scopes when role permissions are empty', async () => {
    const ownerTokenWithEmptyPermissions = await jwtService.signAsync(
      {
        userId: fallbackOwnerUser.id,
        email: fallbackOwnerUser.email,
        tenantId: fallbackOwnerUser.tenantId,
        isTwoFactorAuthenticated: true,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '30m',
      },
    );

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${ownerTokenWithEmptyPermissions}`)
      .expect(200);
  });

  it('drops dangerous object keys during recursive sanitization', () => {
    const input = JSON.parse(
      '{"safe":"ok","nested":{"child":"yes"},"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"poisoned":"yes"}}}',
    ) as Record<string, unknown>;

    const sanitized = sanitizeUnknown(input) as Record<string, unknown>;
    expect(sanitized.safe).toBe('ok');
    expect((sanitized.nested as Record<string, unknown>).child).toBe('yes');
    expect(Object.prototype.hasOwnProperty.call(sanitized, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(sanitized, 'constructor')).toBe(false);
    expect((sanitized as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).poisoned).toBeUndefined();
  });

  it('does not expose tokens in auth response payload and enforces csrf on cookie-authenticated mutation', async () => {
    const authAgent = request.agent(app.getHttpServer());
    const loginResponse = await authAgent
      .post('/auth/signin')
      .send({
        identifier: cookieSessionUser.email,
        password: cookieSessionPassword,
      })
      .expect(200);

    expect(loginResponse.body.accessToken).toBeUndefined();
    expect(loginResponse.body.refreshToken).toBeUndefined();
    expect(loginResponse.body.token).toBeUndefined();
    expect(loginResponse.body.user?.id).toBe(cookieSessionUser.id);

    const csrfCookieName = process.env.AUTH_CSRF_COOKIE_NAME ?? 'rfid.csrf_token';
    const csrfToken = extractCookieValue(loginResponse.headers['set-cookie'], csrfCookieName);
    expect(csrfToken).toBeTruthy();

    await authAgent.post('/auth/logout').send({}).expect(403);

    await authAgent
      .post('/auth/logout')
      .set('x-csrf-token', csrfToken as string)
      .send({})
      .expect(200);
  });

  it('echoes a trusted correlation id on health endpoint', async () => {
    const correlationId = 'rfid-e2e-correlation-1234';
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('x-correlation-id', correlationId)
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.headers['x-correlation-id']).toBe(correlationId);
  });

  it('generates a safe correlation id when header value is invalid', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .set('x-correlation-id', '<invalid>')
      .expect(200);

    expect(response.body.status).toBe('ready');
    const headerValue = response.headers['x-correlation-id'];
    expect(typeof headerValue).toBe('string');
    expect(headerValue).not.toBe('<invalid>');
    expect(String(headerValue)).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
  });

  it('rejects webhook URLs containing embedded credentials', async () => {
    await request(app.getHttpServer())
      .post('/admin/webhooks')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        name: 'Invalid credential URL',
        url: 'https://user:pass@example.com/webhook',
        events: ['ORDER_ALLOCATED'],
      })
      .expect(400);
  });

  it('blocks webhook delivery when endpoint responds with redirect', async () => {
    const redirectServer: Server = createServer((_req, res) => {
      res.statusCode = 302;
      res.setHeader('Location', 'http://localhost:65535/redirect-target');
      res.end('redirect');
    });

    await new Promise<void>((resolve, reject) => {
      redirectServer.once('error', reject);
      redirectServer.listen(0, '127.0.0.1', () => resolve());
    });

    try {
      const serverAddress = redirectServer.address();
      if (!serverAddress || typeof serverAddress === 'string') {
        throw new Error('Unable to resolve redirect server address.');
      }

      const createWebhookResponse = await request(app.getHttpServer())
        .post('/admin/webhooks')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: 'Redirect webhook endpoint',
          url: `http://127.0.0.1:${serverAddress.port}/webhook`,
          events: ['ORDER_ALLOCATED'],
        })
        .expect(201);

      const webhookId = createWebhookResponse.body.id as string;
      expect(webhookId).toBeTruthy();

      await request(app.getHttpServer())
        .post(`/admin/webhooks/${webhookId}/test`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          eventType: 'ORDER_ALLOCATED',
        })
        .expect(500);

      const webhookAfterFailure = await prisma.webhookEndpoint.findUnique({
        where: { id: webhookId },
        select: { failureCount: true },
      });
      expect(webhookAfterFailure?.failureCount ?? 0).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        redirectServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });
});
