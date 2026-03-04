import { BadRequestException, Injectable } from '@nestjs/common';
import {
  HardwareSystemCode,
  IdentifierType,
  Prisma,
  type BusinessSystem,
} from '@prisma/client';
import { sanitizeString } from '../../common/utils/security.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { IdentifiersService } from '../identifiers/identifiers.service';
import { BusinessSystemsService } from '../systems/business-systems.service';
import type {
  DeviceImportValidationIssue,
  DeviceImportValidationRow,
  DeviceSeedInput,
  ListAdminInventoryInput,
  ValidateDeviceImportBatchInput,
} from './inventory.types';

const MAC_ADDRESS_REGEX = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
const WAREHOUSE_CODE_REGEX = /^[A-Z0-9_-]{2,40}$/;

@Injectable()
export class InventoryValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessSystemsService: BusinessSystemsService,
    private readonly identifiersService: IdentifiersService,
  ) {}

  async validateDeviceImportBatch(input: ValidateDeviceImportBatchInput) {
    const system = await this.businessSystemsService.getSystemByIdOrThrow(input.systemId);
    const supportsIdentifiers = this.supportsIdentifiers(system);

    if (!Array.isArray(input.devices) || input.devices.length === 0) {
      throw new BadRequestException('Ajoutez au moins une ligne d import.');
    }

    const rows: DeviceImportValidationRow[] = [];
    const seenMacs = new Set<string>();
    const seenIdentifiers = new Set<string>();
    const defaultWarehouseCode = input.warehouseCode
      ? this.normalizeWarehouseCode(input.warehouseCode)
      : 'MAIN';

    for (let index = 0; index < input.devices.length; index += 1) {
      const sourceRow = input.devices[index];
      const issues: DeviceImportValidationIssue[] = [];
      let normalizedMacAddress = '';
      let normalizedWarehouseCode = defaultWarehouseCode;
      let normalizedIdentifiers: string[] = [];

      try {
        normalizedMacAddress = this.normalizeMacAddress(sourceRow.macAddress);
      } catch {
        issues.push({
          field: 'macAddress',
          code: 'INVALID_MAC',
          message: 'Adresse MAC invalide.',
        });
      }

      try {
        normalizedWarehouseCode = this.normalizeWarehouseCode(
          sourceRow.warehouseCode ?? defaultWarehouseCode,
        );
      } catch {
        issues.push({
          field: 'warehouseCode',
          code: 'INVALID_WAREHOUSE',
          message: 'Code entrepot invalide.',
        });
      }

      if (!supportsIdentifiers) {
        if (Array.isArray(sourceRow.identifiers) && sourceRow.identifiers.length > 0) {
          issues.push({
            field: 'identifiers',
            code: 'IDENTIFIERS_NOT_SUPPORTED',
            message: 'Ce systeme ne supporte pas les identifiants.',
          });
        }
      } else if (!Array.isArray(sourceRow.identifiers)) {
        issues.push({
          field: 'identifiers',
          code: 'IDENTIFIERS_MISSING',
          message: 'Identifiants manquants pour ce boitier.',
        });
      } else {
        if (sourceRow.identifiers.length !== system.identifiersPerDevice) {
          issues.push({
            field: 'identifiers',
            code: 'IDENTIFIERS_COUNT_MISMATCH',
            message: `Nombre d identifiants invalide (attendu: ${system.identifiersPerDevice}).`,
          });
        }

        try {
          normalizedIdentifiers = this.identifiersService.normalizePhysicalIdentifiers(
            sourceRow.identifiers,
          );
        } catch {
          issues.push({
            field: 'identifiers',
            code: 'INVALID_IDENTIFIER_FORMAT',
            message: 'Un ou plusieurs identifiants physiques sont invalides.',
          });
        }
      }

      if (normalizedMacAddress) {
        if (seenMacs.has(normalizedMacAddress)) {
          issues.push({
            field: 'macAddress',
            code: 'DUPLICATE_MAC_IN_FILE',
            message: 'Adresse MAC dupliquee dans le fichier import.',
          });
        } else {
          seenMacs.add(normalizedMacAddress);
        }
      }

      normalizedIdentifiers.forEach((identifier) => {
        if (seenIdentifiers.has(identifier)) {
          issues.push({
            field: 'identifiers',
            code: 'DUPLICATE_IDENTIFIER_IN_FILE',
            message: `Identifiant physique duplique dans le fichier (${identifier}).`,
          });
        } else {
          seenIdentifiers.add(identifier);
        }
      });

      rows.push({
        rowNumber: index + 1,
        macAddress: normalizedMacAddress,
        warehouseCode: normalizedWarehouseCode,
        identifiers: normalizedIdentifiers,
        issues,
      });
    }

    const macsToCheck = rows.map((row) => row.macAddress).filter((entry) => entry.length > 0);
    const identifiersToCheck = rows.flatMap((row) => row.identifiers);

    const [existingDevices, existingIdentifiers] = await Promise.all([
      macsToCheck.length > 0
        ? this.prisma.device.findMany({
            where: {
              macAddress: {
                in: macsToCheck,
              },
            },
            select: {
              macAddress: true,
            },
          })
        : Promise.resolve([]),
      identifiersToCheck.length > 0
        ? this.prisma.identifier.findMany({
            where: {
              physicalIdentifier: {
                in: identifiersToCheck,
              },
            },
            select: {
              physicalIdentifier: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const existingMacSet = new Set(existingDevices.map((device) => device.macAddress));
    const existingIdentifierSet = new Set(
      existingIdentifiers.map((identifier) => identifier.physicalIdentifier),
    );

    rows.forEach((row) => {
      if (row.macAddress && existingMacSet.has(row.macAddress)) {
        row.issues.push({
          field: 'macAddress',
          code: 'MAC_ALREADY_EXISTS',
          message: 'Adresse MAC deja en base.',
        });
      }

      row.identifiers.forEach((identifier) => {
        if (existingIdentifierSet.has(identifier)) {
          row.issues.push({
            field: 'identifiers',
            code: 'IDENTIFIER_ALREADY_EXISTS',
            message: `Identifiant physique deja en base (${identifier}).`,
          });
        }
      });
    });

    const invalidRows = rows.filter((row) => row.issues.length > 0).length;

    return {
      system: {
        id: system.id,
        name: system.name,
        code: system.code,
        hasIdentifiers: supportsIdentifiers,
        identifiersPerDevice: supportsIdentifiers ? system.identifiersPerDevice : 0,
      },
      summary: {
        totalRows: rows.length,
        validRows: rows.length - invalidRows,
        invalidRows,
      },
      canCommit: invalidRows === 0,
      rows,
    };
  }

  normalizeDeviceBatch(
    devices: DeviceSeedInput[],
    system: BusinessSystem,
    defaultWarehouseCode?: string,
  ): Array<{ macAddress: string; identifiers: string[]; warehouseCode: string }> {
    const supportsIdentifiers = this.supportsIdentifiers(system);
    const normalizedMacs = new Set<string>();
    const normalizedPhysicalIdentifiers = new Set<string>();
    const normalizedDefaultWarehouseCode = defaultWarehouseCode
      ? this.normalizeWarehouseCode(defaultWarehouseCode)
      : undefined;

    return devices.map((device, index) => {
      const macAddress = this.normalizeMacAddress(device.macAddress);

      if (normalizedMacs.has(macAddress)) {
        throw new BadRequestException(`Adresse MAC dupliquee dans la requete (position ${index + 1}).`);
      }
      normalizedMacs.add(macAddress);

      const warehouseCode = this.normalizeWarehouseCode(
        device.warehouseCode ?? normalizedDefaultWarehouseCode ?? 'MAIN',
      );

      if (!supportsIdentifiers) {
        if (Array.isArray(device.identifiers) && device.identifiers.length > 0) {
          throw new BadRequestException('Ce systeme ne supporte pas les identifiants materiels.');
        }
        return {
          macAddress,
          warehouseCode,
          identifiers: [],
        };
      }

      if (!Array.isArray(device.identifiers)) {
        throw new BadRequestException('Chaque boitier doit contenir ses identifiants physiques.');
      }

      if (device.identifiers.length !== system.identifiersPerDevice) {
        throw new BadRequestException(
          `Chaque boitier doit contenir exactement ${system.identifiersPerDevice} identifiants.`,
        );
      }

      const normalizedIdentifiers = this.identifiersService.normalizePhysicalIdentifiers(
        device.identifiers,
      );

      normalizedIdentifiers.forEach((physicalIdentifier) => {
        if (normalizedPhysicalIdentifiers.has(physicalIdentifier)) {
          throw new BadRequestException(
            'Chaque identifiant physique doit etre unique dans le lot soumis.',
          );
        }
        normalizedPhysicalIdentifiers.add(physicalIdentifier);
      });

      return {
        macAddress,
        warehouseCode,
        identifiers: normalizedIdentifiers,
      };
    });
  }

  normalizeMacAddress(value: string): string {
    const normalized = sanitizeString(String(value))
      .toUpperCase()
      .replaceAll('-', ':');

    if (!MAC_ADDRESS_REGEX.test(normalized)) {
      throw new BadRequestException('Adresse MAC invalide. Format attendu: AA:BB:CC:DD:EE:FF');
    }

    return normalized;
  }

  normalizeWarehouseCode(value: string): string {
    const normalized = sanitizeString(String(value)).toUpperCase();
    if (!WAREHOUSE_CODE_REGEX.test(normalized)) {
      throw new BadRequestException(
        'Code entrepot invalide. Format attendu: 2-40 caracteres [A-Z0-9_-].',
      );
    }
    return normalized;
  }

  resolveIdentifierType(params: {
    system: BusinessSystem;
    requestedType?: IdentifierType;
  }): IdentifierType {
    if (!this.supportsIdentifiers(params.system)) {
      throw new BadRequestException('Ce systeme ne gere pas les extensions.');
    }

    const systemIdentifierType = params.system.identifierType;
    const resolvedType = params.requestedType ?? systemIdentifierType;

    if (!resolvedType) {
      throw new BadRequestException('Impossible de determiner le type d identifiant.');
    }

    if (systemIdentifierType && resolvedType !== systemIdentifierType) {
      throw new BadRequestException(
        `Type incompatible. Ce systeme accepte uniquement ${systemIdentifierType}.`,
      );
    }

    return resolvedType;
  }

  supportsIdentifiers(system: Pick<BusinessSystem, 'code' | 'hasIdentifiers'>): boolean {
    return system.code !== HardwareSystemCode.FEEDBACK && system.hasIdentifiers;
  }

  async buildDeviceInventoryWhere(input: ListAdminInventoryInput): Promise<Prisma.DeviceWhereInput> {
    const where: Prisma.DeviceWhereInput = {};

    const systemId = input.systemId?.trim();
    const systemCode = input.systemCode;

    if (systemId) {
      where.systemId = systemId;
    } else if (systemCode) {
      const system = await this.businessSystemsService.getSystemByCodeOrThrow(systemCode, false);
      where.systemId = system.id;
    }

    if (input.status) {
      where.status = input.status;
    }

    if (input.warehouseCode?.trim()) {
      where.warehouseCode = this.normalizeWarehouseCode(input.warehouseCode);
    }

    const search = input.search?.trim();
    if (search) {
      where.OR = [
        {
          macAddress: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          id: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          identifiers: {
            some: {
              physicalIdentifier: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    return where;
  }
}
