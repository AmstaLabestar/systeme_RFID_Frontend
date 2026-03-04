import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  HardwareSystemCode,
  IdentifierType,
  OrderTargetType,
  type BusinessSystem,
  type Role,
  type Tenant,
  type User,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SanitizeBodyPipe } from '../src/common/pipes/sanitize-body.pipe';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

function ensureE2eEnv(): void {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  process.env.PORT = process.env.PORT ?? '4012';
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

function createRandomMacAddress(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

function createRandomBadgeCode(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function hasCookie(setCookies: string[] | undefined, cookieName: string): boolean {
  if (!setCookies || setCookies.length === 0) {
    return false;
  }
  const prefix = `${cookieName}=`;
  return setCookies.some((cookie) => cookie.startsWith(prefix));
}

describe('Critical flows characterization e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let tenant: Tenant;
  let adminRole: Role;
  let memberRole: Role;
  let adminUser: User;
  let memberUser: User;
  let system: BusinessSystem;
  let adminAccessToken = '';
  let memberAccessToken = '';
  let memberPassword = '';
  const createdDeviceIds: string[] = [];
  const createdDeviceMacs: string[] = [];
  const createdIdentifierCodes: string[] = [];

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
        name: 'Critical Flows Tenant',
        domain: `critical-flows-${randomUUID().slice(0, 8)}.local`,
      },
    });

    adminRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: 'admin',
        permissions: ['*'],
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
        name: 'Critical Admin',
        email: `critical-admin-${randomUUID().slice(0, 8)}@rfid-e2e.local`,
        roleId: adminRole.id,
        tenantId: tenant.id,
      },
    });

    memberPassword = 'StrongPass#123';
    memberUser = await prisma.user.create({
      data: {
        name: 'Critical Member',
        email: `critical-member-${randomUUID().slice(0, 8)}@rfid-e2e.local`,
        passwordHash: await bcrypt.hash(memberPassword, 12),
        roleId: memberRole.id,
        tenantId: tenant.id,
      },
    });

    system =
      (await prisma.businessSystem.findUnique({
        where: { code: HardwareSystemCode.RFID_PRESENCE },
      })) ??
      (await prisma.businessSystem.create({
        data: {
          name: 'RFID Presence',
          code: HardwareSystemCode.RFID_PRESENCE,
          hasIdentifiers: true,
          identifiersPerDevice: 5,
          identifierType: IdentifierType.BADGE,
          isActive: true,
        },
      }));

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

    memberAccessToken = await jwtService.signAsync(
      {
        userId: memberUser.id,
        email: memberUser.email,
        tenantId: memberUser.tenantId,
        isTwoFactorAuthenticated: true,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '30m',
      },
    );
  });

  afterAll(async () => {
    await prisma.identifier.updateMany({
      where: {
        physicalIdentifier: {
          in: createdIdentifierCodes,
        },
      },
      data: {
        status: 'IN_STOCK',
        ownerId: null,
        ownerTenantId: null,
        reservedAt: null,
        reservationExpiresAt: null,
        deviceId: null,
      },
    });

    await prisma.device.updateMany({
      where: {
        id: {
          in: createdDeviceIds,
        },
      },
      data: {
        status: 'IN_STOCK',
        ownerId: null,
        ownerTenantId: null,
        assignedAt: null,
        reservedAt: null,
        reservationExpiresAt: null,
      },
    });

    await prisma.order.deleteMany({
      where: {
        customerId: memberUser?.id,
      },
    });

    if (createdIdentifierCodes.length > 0) {
      await prisma.identifier.deleteMany({
        where: {
          physicalIdentifier: {
            in: createdIdentifierCodes,
          },
        },
      });
    }

    if (createdDeviceMacs.length > 0) {
      await prisma.device.deleteMany({
        where: {
          macAddress: {
            in: createdDeviceMacs,
          },
        },
      });
    }

    await prisma.adminActionLog.deleteMany({
      where: {
        actorId: {
          in: [adminUser?.id, memberUser?.id].filter((value): value is string => Boolean(value)),
        },
      },
    });

    await prisma.refreshToken.deleteMany({
      where: {
        userId: {
          in: [adminUser?.id, memberUser?.id].filter((value): value is string => Boolean(value)),
        },
      },
    });

    await prisma.magicLinkToken.deleteMany({
      where: {
        userId: {
          in: [adminUser?.id, memberUser?.id].filter((value): value is string => Boolean(value)),
        },
      },
    });

    if (memberUser) {
      await prisma.user.delete({
        where: { id: memberUser.id },
      });
    }

    if (adminUser) {
      await prisma.user.delete({
        where: { id: adminUser.id },
      });
    }

    if (memberRole) {
      await prisma.role.delete({
        where: { id: memberRole.id },
      });
    }

    if (adminRole) {
      await prisma.role.delete({
        where: { id: adminRole.id },
      });
    }

    if (tenant) {
      await prisma.tenant.delete({
        where: { id: tenant.id },
      });
    }

    await app.close();
  });

  async function createAdminStockedDevice(): Promise<{
    deviceId: string;
    macAddress: string;
    identifiers: string[];
  }> {
    const macAddress = createRandomMacAddress();
    const identifiers = Array.from({ length: 5 }).map((_, index) =>
      createRandomBadgeCode(`BADGE${index + 1}`),
    );

    const validateResponse = await request(app.getHttpServer())
      .post(`/admin/systems/${system.id}/devices/import/validate`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        warehouseCode: 'E2E',
        devices: [
          {
            macAddress,
            identifiers,
            warehouseCode: 'E2E',
          },
        ],
      })
      .expect(201);

    expect(validateResponse.body.canCommit).toBe(true);
    expect(validateResponse.body.summary.totalRows).toBe(1);
    expect(validateResponse.body.summary.invalidRows).toBe(0);

    const createResponse = await request(app.getHttpServer())
      .post(`/admin/systems/${system.id}/devices/bulk`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        quantity: 1,
        warehouseCode: 'E2E',
        devices: [
          {
            macAddress,
            identifiers,
            warehouseCode: 'E2E',
          },
        ],
      })
      .expect(201);

    const createdDeviceId = createResponse.body.devices?.[0]?.id as string | undefined;
    expect(createResponse.body.created).toBe(1);
    expect(createdDeviceId).toBeTruthy();
    if (!createdDeviceId) {
      throw new Error('Device was not created during test setup.');
    }

    createdDeviceIds.push(createdDeviceId);
    createdDeviceMacs.push(macAddress);
    createdIdentifierCodes.push(...identifiers);

    // Keep deterministic selection for allocation (oldest stock first).
    await prisma.device.update({
      where: { id: createdDeviceId },
      data: { createdAt: new Date('2000-01-01T00:00:00.000Z') },
    });

    await prisma.identifier.updateMany({
      where: { deviceId: createdDeviceId },
      data: { createdAt: new Date('2000-01-01T00:00:00.000Z') },
    });

    return {
      deviceId: createdDeviceId,
      macAddress,
      identifiers,
    };
  }

  async function allocateOneDeviceToMember(expectedDeviceId: string, idempotencyKey: string) {
    const response = await request(app.getHttpServer())
      .post('/marketplace/orders')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        systemCode: HardwareSystemCode.RFID_PRESENCE,
        targetType: OrderTargetType.DEVICE,
        quantity: 1,
      })
      .expect(201);

    expect(response.body.order?.status).toBe('COMPLETED');
    expect(Array.isArray(response.body.allocatedDevices)).toBe(true);
    expect(response.body.allocatedDevices).toHaveLength(1);
    expect(response.body.allocatedDevices[0]?.id).toBe(expectedDeviceId);
    return response;
  }

  it('login flow: returns public user payload and sets auth cookies', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({
        identifier: memberUser.email,
        password: memberPassword,
      })
      .expect(200);

    expect(loginResponse.body.user?.id).toBe(memberUser.id);
    expect(loginResponse.body.user?.email).toBe(memberUser.email);
    expect(loginResponse.body.accessToken).toBeUndefined();
    expect(loginResponse.body.refreshToken).toBeUndefined();
    expect(loginResponse.body.token).toBeUndefined();

    const rawSetCookie = loginResponse.headers['set-cookie'] as string | string[] | undefined;
    const setCookies = Array.isArray(rawSetCookie)
      ? rawSetCookie
      : rawSetCookie
        ? [rawSetCookie]
        : undefined;
    expect(hasCookie(setCookies, process.env.AUTH_ACCESS_COOKIE_NAME ?? 'rfid.access_token')).toBe(
      true,
    );
    expect(
      hasCookie(setCookies, process.env.AUTH_REFRESH_COOKIE_NAME ?? 'rfid.refresh_token'),
    ).toBe(true);
    expect(hasCookie(setCookies, process.env.AUTH_CSRF_COOKIE_NAME ?? 'rfid.csrf_token')).toBe(
      true,
    );
  });

  it('purchase flow: allocates stock and keeps idempotent order replay stable', async () => {
    const stockedDevice = await createAdminStockedDevice();
    const idempotencyKey = `critical-purchase-${randomUUID()}`;

    const firstOrderResponse = await allocateOneDeviceToMember(stockedDevice.deviceId, idempotencyKey);
    const replayOrderResponse = await allocateOneDeviceToMember(stockedDevice.deviceId, idempotencyKey);

    expect(replayOrderResponse.body.order?.id).toBe(firstOrderResponse.body.order?.id);
    expect(replayOrderResponse.body.allocatedDevices?.[0]?.id).toBe(stockedDevice.deviceId);

    const myDevicesResponse = await request(app.getHttpServer())
      .get('/devices/my')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(200);

    expect(Array.isArray(myDevicesResponse.body.devices)).toBe(true);
    expect(myDevicesResponse.body.pagination?.devices?.limit).toBeGreaterThan(0);
    expect(typeof myDevicesResponse.body.pagination?.devices?.hasMore).toBe('boolean');
    expect(Array.isArray(myDevicesResponse.body.standaloneIdentifiers)).toBe(true);

    const allocatedDevice = (myDevicesResponse.body.devices as Array<{ id: string; macAddress: string }>).find(
      (device) => device.id === stockedDevice.deviceId,
    );
    expect(allocatedDevice).toBeDefined();
    expect(allocatedDevice?.macAddress).toBe(stockedDevice.macAddress);
  });

  it('activation flow: configures an allocated device with matching MAC', async () => {
    const stockedDevice = await createAdminStockedDevice();
    const idempotencyKey = `critical-activation-${randomUUID()}`;

    await allocateOneDeviceToMember(stockedDevice.deviceId, idempotencyKey);

    const configureResponse = await request(app.getHttpServer())
      .patch(`/devices/${stockedDevice.deviceId}/configure`)
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .send({
        name: 'Reception Unit',
        location: 'Reception',
        systemIdentifier: stockedDevice.macAddress,
      })
      .expect(200);

    expect(configureResponse.body.id).toBe(stockedDevice.deviceId);
    expect(configureResponse.body.isConfigured).toBe(true);
    expect(configureResponse.body.configuredName).toBe('Reception Unit');
    expect(configureResponse.body.configuredLocation).toBe('Reception');

    const myDevicesResponse = await request(app.getHttpServer())
      .get('/devices/my')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(200);

    const configuredDevice = (
      myDevicesResponse.body.devices as Array<{
        id: string;
        isConfigured: boolean;
        configuredName?: string | null;
        configuredLocation?: string | null;
      }>
    ).find((device) => device.id === stockedDevice.deviceId);

    expect(configuredDevice).toBeDefined();
    expect(configuredDevice?.isConfigured).toBe(true);
    expect(configuredDevice?.configuredName).toBe('Reception Unit');
    expect(configuredDevice?.configuredLocation).toBe('Reception');
  });
});
