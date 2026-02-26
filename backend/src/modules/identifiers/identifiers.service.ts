import { BadRequestException, Injectable } from '@nestjs/common';
import { IdentifierStatus, type Identifier, type IdentifierType, type Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { sanitizeString } from '../../common/utils/security.util';

const IDENTIFIER_MAC_REGEX = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
const GENERIC_IDENTIFIER_REGEX = /^[A-Z0-9][A-Z0-9:_-]{1,119}$/;

interface CreateIdentifiersInput {
  systemId: string;
  type: IdentifierType;
  physicalIdentifiers: string[];
  deviceId?: string | null;
  createdById?: string;
  warehouseCode?: string;
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
        warehouseCode: payload.warehouseCode ?? 'MAIN',
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
    if (!normalized) {
      throw new BadRequestException('Chaque identifiant physique doit etre renseigne.');
    }

    const normalizedAsMac = normalized.replaceAll('-', ':');
    if (IDENTIFIER_MAC_REGEX.test(normalizedAsMac)) {
      return normalizedAsMac;
    }

    if (!GENERIC_IDENTIFIER_REGEX.test(normalized)) {
      throw new BadRequestException(
        'Identifiant physique invalide. Utilisez une MAC (AA:BB:CC:DD:EE:FF) ou un code alphanumerique (A-Z, 0-9, -, _, :).',
      );
    }

    return normalized;
  }
}
