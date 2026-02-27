import { HardwareSystemCode, IdentifierType, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_ROLE_PERMISSIONS } from '../src/common/permissions.constants';

const prisma = new PrismaClient();

function normalizeRoleName(value: string): string {
  return value.trim().toLowerCase();
}

function readRolePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

async function main() {
  const tenantName = process.env.DEFAULT_TENANT_NAME ?? 'Tech Souveraine';
  const tenantDomain = process.env.DEFAULT_TENANT_DOMAIN ?? 'techsouveraine.local';
  const roleName = process.env.DEFAULT_ROLE_NAME ?? 'owner';
  const normalizedRoleName = normalizeRoleName(roleName);
  const defaultRolePermissions = DEFAULT_ROLE_PERMISSIONS[normalizedRoleName] ?? ['*'];
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@techsouveraine.local';
  const adminName = process.env.SEED_ADMIN_NAME ?? 'Platform Admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

  const tenant = await prisma.tenant.upsert({
    where: { domain: tenantDomain.toLowerCase() },
    update: { name: tenantName },
    create: {
      name: tenantName,
      domain: tenantDomain.toLowerCase(),
    },
  });

  const role = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: normalizedRoleName,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: normalizedRoleName,
      permissions: defaultRolePermissions,
    },
  });

  const currentRolePermissions = readRolePermissions(role.permissions);
  if (currentRolePermissions.length === 0 && defaultRolePermissions.length > 0) {
    await prisma.role.update({
      where: { id: role.id },
      data: { permissions: defaultRolePermissions },
    });
  }

  const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

  await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      name: adminName,
      passwordHash,
      tenantId: tenant.id,
      roleId: role.id,
    },
    create: {
      name: adminName,
      email: adminEmail.toLowerCase(),
      passwordHash,
      tenantId: tenant.id,
      roleId: role.id,
    },
  });

  const defaultSystems = [
    {
      name: 'RFID Presence',
      code: HardwareSystemCode.RFID_PRESENCE,
      hasIdentifiers: true,
      identifiersPerDevice: 5,
      identifierType: IdentifierType.BADGE,
      deviceUnitPriceCents: 21000,
      extensionUnitPriceCents: 1000,
      currency: 'XOF',
      isActive: true,
    },
    {
      name: 'RFID Porte',
      code: HardwareSystemCode.RFID_PORTE,
      hasIdentifiers: true,
      identifiersPerDevice: 5,
      identifierType: IdentifierType.SERRURE,
      deviceUnitPriceCents: 20000,
      extensionUnitPriceCents: 1000,
      currency: 'XOF',
      isActive: true,
    },
    {
      name: 'Biometrie',
      code: HardwareSystemCode.BIOMETRIE,
      hasIdentifiers: true,
      identifiersPerDevice: 5,
      identifierType: IdentifierType.EMPREINTE,
      deviceUnitPriceCents: 20000,
      extensionUnitPriceCents: 1000,
      currency: 'XOF',
      isActive: true,
    },
    {
      name: 'Feedback',
      code: HardwareSystemCode.FEEDBACK,
      hasIdentifiers: false,
      identifiersPerDevice: 0,
      identifierType: null,
      deviceUnitPriceCents: 15000,
      extensionUnitPriceCents: 0,
      currency: 'XOF',
      isActive: true,
    },
  ];

  for (const system of defaultSystems) {
    await prisma.businessSystem.upsert({
      where: { code: system.code },
      update: {
        name: system.name,
        hasIdentifiers: system.hasIdentifiers,
        identifiersPerDevice: system.identifiersPerDevice,
        identifierType: system.identifierType,
        deviceUnitPriceCents: system.deviceUnitPriceCents,
        extensionUnitPriceCents: system.extensionUnitPriceCents,
        currency: system.currency,
        isActive: system.isActive,
      },
      create: system,
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
