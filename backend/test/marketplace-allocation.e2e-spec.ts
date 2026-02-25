import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  HardwareSystemCode,
  IdentifierType,
  OrderTargetType,
  type BusinessSystem,
  type User,
} from '@prisma/client';
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

describe('Marketplace allocation e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminUser: User;
  let clientUser: User;
  let targetSystem: BusinessSystem;
  let adminAccessToken = '';
  let clientAccessToken = '';
  let tenantId = '';
  let adminRoleId = '';
  let memberRoleId = '';
  let createdDeviceId: string | null = null;
  let createdMacAddress = '';
  let createdIdentifierCodes: string[] = [];

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

    const tenantDomain = `e2e-allocation-${randomUUID().slice(0, 8)}.local`;
    const tenant = await prisma.tenant.create({
      data: {
        name: 'E2E Allocation Tenant',
        domain: tenantDomain,
      },
    });
    tenantId = tenant.id;

    const adminRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: 'admin',
        permissions: ['*'],
      },
    });
    adminRoleId = adminRole.id;

    const memberRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: 'member',
        permissions: [],
      },
    });
    memberRoleId = memberRole.id;

    adminUser = await prisma.user.create({
      data: {
        name: 'E2E Admin',
        email: `admin-${randomUUID().slice(0, 8)}@rfid-e2e.local`,
        roleId: adminRole.id,
        tenantId: tenant.id,
      },
    });

    clientUser = await prisma.user.create({
      data: {
        name: 'E2E Client',
        email: `client-${randomUUID().slice(0, 8)}@rfid-e2e.local`,
        roleId: memberRole.id,
        tenantId: tenant.id,
      },
    });

    targetSystem =
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
        isTwoFactorAuthenticated: true,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '30m',
      },
    );

    clientAccessToken = await jwtService.signAsync(
      {
        userId: clientUser.id,
        email: clientUser.email,
        isTwoFactorAuthenticated: true,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '30m',
      },
    );
  });

  afterAll(async () => {
    if (createdDeviceId) {
      await prisma.identifier.updateMany({
        where: {
          deviceId: createdDeviceId,
          ownerId: clientUser?.id,
        },
        data: {
          status: 'IN_STOCK',
          ownerId: null,
          ownerTenantId: null,
          reservedAt: null,
          reservationExpiresAt: null,
        },
      });

      await prisma.device.updateMany({
        where: {
          id: createdDeviceId,
          ownerId: clientUser?.id,
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
    }

    if (createdIdentifierCodes.length > 0) {
      await prisma.identifier.deleteMany({
        where: {
          physicalIdentifier: {
            in: createdIdentifierCodes,
          },
        },
      });
    }

    if (createdMacAddress) {
      await prisma.device.deleteMany({
        where: {
          macAddress: createdMacAddress,
        },
      });
    }

    if (clientUser) {
      await prisma.order.deleteMany({
        where: {
          customerId: clientUser.id,
        },
      });
    }

    await prisma.adminActionLog.deleteMany({
      where: {
        actorId: {
          in: [adminUser?.id, clientUser?.id].filter((value): value is string => Boolean(value)),
        },
      },
    });

    if (clientUser) {
      await prisma.user.delete({
        where: {
          id: clientUser.id,
        },
      });
    }

    if (adminUser) {
      await prisma.user.delete({
        where: {
          id: adminUser.id,
        },
      });
    }

    if (memberRoleId) {
      await prisma.role.delete({
        where: {
          id: memberRoleId,
        },
      });
    }

    if (adminRoleId) {
      await prisma.role.delete({
        where: {
          id: adminRoleId,
        },
      });
    }

    if (tenantId) {
      await prisma.tenant.delete({
        where: {
          id: tenantId,
        },
      });
    }

    await app.close();
  });

  it('imports stock via admin, allocates existing hardware, and exposes it in /devices/my', async () => {
    createdMacAddress = createRandomMacAddress();
    createdIdentifierCodes = Array.from({ length: 5 }).map(
      (_, index) => `E2E-BADGE-${randomUUID().slice(0, 8).toUpperCase()}-${index + 1}`,
    );

    const validationResponse = await request(app.getHttpServer())
      .post(`/admin/systems/${targetSystem.id}/devices/import/validate`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        warehouseCode: 'E2E',
        devices: [
          {
            macAddress: createdMacAddress,
            identifiers: createdIdentifierCodes,
            warehouseCode: 'E2E',
          },
        ],
      })
      .expect(201);

    expect(validationResponse.body.canCommit).toBe(true);
    expect(validationResponse.body.summary.totalRows).toBe(1);
    expect(validationResponse.body.summary.invalidRows).toBe(0);

    const createStockResponse = await request(app.getHttpServer())
      .post(`/admin/systems/${targetSystem.id}/devices/bulk`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        quantity: 1,
        warehouseCode: 'E2E',
        devices: [
          {
            macAddress: createdMacAddress,
            identifiers: createdIdentifierCodes,
            warehouseCode: 'E2E',
          },
        ],
      })
      .expect(201);

    createdDeviceId = createStockResponse.body.devices?.[0]?.id ?? null;
    expect(createStockResponse.body.created).toBe(1);
    expect(createdDeviceId).toBeTruthy();

    if (!createdDeviceId) {
      throw new Error('Device creation failed in e2e setup.');
    }

    // Force deterministic pick by allocator (ORDER BY createdAt ASC).
    await prisma.device.update({
      where: { id: createdDeviceId },
      data: {
        createdAt: new Date('2000-01-01T00:00:00.000Z'),
      },
    });

    await prisma.identifier.updateMany({
      where: { deviceId: createdDeviceId },
      data: {
        createdAt: new Date('2000-01-01T00:00:00.000Z'),
      },
    });

    const idempotencyKey = `e2e-order-${randomUUID()}`;

    const firstOrderResponse = await request(app.getHttpServer())
      .post('/marketplace/orders')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        systemCode: HardwareSystemCode.RFID_PRESENCE,
        targetType: OrderTargetType.DEVICE,
        quantity: 1,
      })
      .expect(201);

    expect(firstOrderResponse.body.order?.status).toBe('COMPLETED');
    expect(Array.isArray(firstOrderResponse.body.allocatedDevices)).toBe(true);
    expect(firstOrderResponse.body.allocatedDevices.length).toBe(1);
    expect(firstOrderResponse.body.allocatedDevices[0].id).toBe(createdDeviceId);

    const secondOrderResponse = await request(app.getHttpServer())
      .post('/marketplace/orders')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        systemCode: HardwareSystemCode.RFID_PRESENCE,
        targetType: OrderTargetType.DEVICE,
        quantity: 1,
      })
      .expect(201);

    expect(secondOrderResponse.body.order?.id).toBe(firstOrderResponse.body.order?.id);

    const myDevicesResponse = await request(app.getHttpServer())
      .get('/devices/my')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .expect(200);

    const devices = myDevicesResponse.body.devices as Array<{
      id: string;
      macAddress: string;
      identifiers: Array<{ physicalIdentifier: string }>;
    }>;

    const allocatedDevice = devices.find((device) => device.id === createdDeviceId);
    expect(allocatedDevice).toBeDefined();
    expect(allocatedDevice?.macAddress).toBe(createdMacAddress);
    expect(allocatedDevice?.identifiers.length).toBe(5);
  });
});
