import { HardwareSystemCode, IdentifierStatus, PrismaClient } from '@prisma/client';

interface CliOptions {
  apply: boolean;
  force: boolean;
}

interface FeedbackIdentifierStats {
  total: number;
  inStock: number;
  reserved: number;
  assigned: number;
  linkedToDevice: number;
  ownedByCustomer: number;
  allocationsReferencing: number;
  stockMovementsReferencing: number;
}

function parseCliOptions(argv: string[]): CliOptions {
  const normalizedArgs = argv.map((arg) => arg.trim().toLowerCase());
  return {
    apply: normalizedArgs.includes('--apply'),
    force: normalizedArgs.includes('--force'),
  };
}

async function collectFeedbackIdentifierStats(
  prisma: PrismaClient,
  feedbackSystemId: string,
): Promise<FeedbackIdentifierStats> {
  const [
    total,
    inStock,
    reserved,
    assigned,
    linkedToDevice,
    ownedByCustomer,
    allocationsReferencing,
    stockMovementsReferencing,
  ] = await Promise.all([
    prisma.identifier.count({
      where: { systemId: feedbackSystemId },
    }),
    prisma.identifier.count({
      where: { systemId: feedbackSystemId, status: IdentifierStatus.IN_STOCK },
    }),
    prisma.identifier.count({
      where: { systemId: feedbackSystemId, status: IdentifierStatus.RESERVED },
    }),
    prisma.identifier.count({
      where: { systemId: feedbackSystemId, status: IdentifierStatus.ASSIGNED },
    }),
    prisma.identifier.count({
      where: { systemId: feedbackSystemId, deviceId: { not: null } },
    }),
    prisma.identifier.count({
      where: { systemId: feedbackSystemId, ownerId: { not: null } },
    }),
    prisma.allocation.count({
      where: {
        identifier: {
          systemId: feedbackSystemId,
        },
      },
    }),
    prisma.stockMovement.count({
      where: {
        identifier: {
          systemId: feedbackSystemId,
        },
      },
    }),
  ]);

  return {
    total,
    inStock,
    reserved,
    assigned,
    linkedToDevice,
    ownedByCustomer,
    allocationsReferencing,
    stockMovementsReferencing,
  };
}

function printStats(stats: FeedbackIdentifierStats): void {
  console.log('Feedback identifiers summary:');
  console.log(`- total: ${stats.total}`);
  console.log(`- in_stock: ${stats.inStock}`);
  console.log(`- reserved: ${stats.reserved}`);
  console.log(`- assigned: ${stats.assigned}`);
  console.log(`- linked_to_device: ${stats.linkedToDevice}`);
  console.log(`- owned_by_customer: ${stats.ownedByCustomer}`);
  console.log(`- allocations_referencing: ${stats.allocationsReferencing}`);
  console.log(`- stock_movements_referencing: ${stats.stockMovementsReferencing}`);
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const feedbackSystem = await prisma.businessSystem.findUnique({
      where: { code: HardwareSystemCode.FEEDBACK },
      select: {
        id: true,
        name: true,
        code: true,
        hasIdentifiers: true,
        identifiersPerDevice: true,
        identifierType: true,
      },
    });

    if (!feedbackSystem) {
      console.log('No FEEDBACK system found. Nothing to clean.');
      return;
    }

    console.log(`Found FEEDBACK system: ${feedbackSystem.name} (${feedbackSystem.id})`);
    console.log(
      `Current config: hasIdentifiers=${feedbackSystem.hasIdentifiers}, identifiersPerDevice=${feedbackSystem.identifiersPerDevice}, identifierType=${feedbackSystem.identifierType ?? 'null'}`,
    );

    const beforeStats = await collectFeedbackIdentifierStats(prisma, feedbackSystem.id);
    printStats(beforeStats);

    if (!options.apply) {
      console.log('');
      console.log('Dry-run mode: no data changed.');
      console.log('Run with --apply to execute cleanup.');
      console.log(
        'If you have RESERVED/ASSIGNED feedback identifiers and still want cleanup, use --apply --force.',
      );
      return;
    }

    if (!options.force && (beforeStats.assigned > 0 || beforeStats.reserved > 0)) {
      throw new Error(
        'Cleanup blocked: FEEDBACK identifiers are RESERVED or ASSIGNED. Re-run with --apply --force if intentional.',
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.businessSystem.update({
        where: { id: feedbackSystem.id },
        data: {
          hasIdentifiers: false,
          identifiersPerDevice: 0,
          identifierType: null,
        },
      });

      const deletedIdentifiers = await tx.identifier.deleteMany({
        where: {
          systemId: feedbackSystem.id,
        },
      });

      return {
        deletedIdentifiers: deletedIdentifiers.count,
      };
    });

    console.log('');
    console.log(`Cleanup applied. Deleted FEEDBACK identifiers: ${result.deletedIdentifiers}`);

    const afterStats = await collectFeedbackIdentifierStats(prisma, feedbackSystem.id);
    printStats(afterStats);
    console.log('FEEDBACK is now strictly device + MAC only.');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error('Cleanup failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
