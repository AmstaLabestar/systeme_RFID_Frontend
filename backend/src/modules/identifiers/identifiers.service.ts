import { BadRequestException, Injectable } from '@nestjs/common';
import { IdentifierStatus, type Identifier, type IdentifierType, type Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { sanitizeString } from '../../common/utils/security.util';

interface CreateIdentifiersInput {
  systemId: string;
  type: IdentifierType;
  physicalIdentifiers: string[];
  deviceId?: string | null;
  createdById?: string;
}

@Injectable()
export class IdentifiersService {
  constructor(private readonly prisma: PrismaService) {}

  normalizePhysicalIdentifiers(values: string[]): string[] {
    if (!Array.isArray(values) || values.length === 0) {
      throw new BadRequestException('Au moins un identifiant physique est requis.');
    }

    const normalized = values.map((value) => this.normalizePhysicalIdentifier(value));
    const duplicates = normalized.filter(
      (entry, index) => normalized.indexOf(entry) !== index,
    );

    if (duplicates.length > 0) {
      throw new BadRequestException('Les identifiants physiques doivent etre uniques dans la requete.');
    }

    return normalized;
  }

  async createIdentifiers(
    payload: CreateIdentifiersInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Identifier[]> {
    const client = tx ?? this.prisma;

    const normalizedIdentifiers = this.normalizePhysicalIdentifiers(payload.physicalIdentifiers);

    await client.identifier.createMany({
      data: normalizedIdentifiers.map((physicalIdentifier) => ({
        systemId: payload.systemId,
        type: payload.type,
        physicalIdentifier,
        status: IdentifierStatus.IN_STOCK,
        deviceId: payload.deviceId ?? null,
        createdById: payload.createdById,
      })),
    });

    return client.identifier.findMany({
      where: {
        physicalIdentifier: {
          in: normalizedIdentifiers,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private normalizePhysicalIdentifier(value: string): string {
    const normalized = sanitizeString(String(value)).toUpperCase();

    if (normalized.length < 3 || normalized.length > 120) {
      throw new BadRequestException('Chaque identifiant physique doit contenir entre 3 et 120 caracteres.');
    }

    return normalized;
  }
}
