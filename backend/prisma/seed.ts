import { HardwareSystemCode, IdentifierType, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const tenantName = process.env.DEFAULT_TENANT_NAME ?? 'Tech Souveraine';
  const tenantDomain = process.env.DEFAULT_TENANT_DOMAIN ?? 'techsouveraine.local';
  const roleName = process.env.DEFAULT_ROLE_NAME ?? 'owner';
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
        name: roleName,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: roleName,
      permissions: ['*'],
    },
  });

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
      isActive: true,
    },
    {
      name: 'RFID Porte',
      code: HardwareSystemCode.RFID_PORTE,
      hasIdentifiers: true,
      identifiersPerDevice: 5,
      identifierType: IdentifierType.SERRURE,
      isActive: true,
    },
    {
      name: 'Biometrie',
      code: HardwareSystemCode.BIOMETRIE,
      hasIdentifiers: true,
      identifiersPerDevice: 5,
      identifierType: IdentifierType.EMPREINTE,
      isActive: true,
    },
    {
      name: 'Feedback',
      code: HardwareSystemCode.FEEDBACK,
      hasIdentifiers: false,
      identifiersPerDevice: 0,
      identifierType: null,
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
