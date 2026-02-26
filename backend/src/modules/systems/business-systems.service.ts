import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HardwareSystemCode, type BusinessSystem, type IdentifierType, Prisma } from '@prisma/client';
import { CreateBusinessSystemDto } from './dto/create-business-system.dto';
import { UpdateBusinessSystemPricingDto } from './dto/update-business-system-pricing.dto';
import { BusinessSystemsRepository } from './repositories/business-systems.repository';

function getExpectedIdentifierType(code: HardwareSystemCode): IdentifierType | null {
  switch (code) {
    case HardwareSystemCode.RFID_PRESENCE:
      return 'BADGE';
    case HardwareSystemCode.RFID_PORTE:
      return 'SERRURE';
    case HardwareSystemCode.BIOMETRIE:
      return 'EMPREINTE';
    case HardwareSystemCode.FEEDBACK:
      return null;
    default:
      return null;
  }
}

function sanitizeIdentifiersConfiguration(params: {
  code: HardwareSystemCode;
  hasIdentifiers: boolean;
  identifiersPerDevice: number;
  identifierType?: IdentifierType | null;
}): { hasIdentifiers: boolean; identifiersPerDevice: number; identifierType: IdentifierType | null } {
  const expectedIdentifierType = getExpectedIdentifierType(params.code);

  if (!expectedIdentifierType) {
    if (params.hasIdentifiers || params.identifiersPerDevice > 0 || params.identifierType) {
      throw new BadRequestException(
        'Le systeme FEEDBACK ne supporte aucune extension. Utilisez hasIdentifiers=false, identifiersPerDevice=0 et identifierType=null.',
      );
    }

    return {
      hasIdentifiers: false,
      identifiersPerDevice: 0,
      identifierType: null,
    };
  }

  if (!params.hasIdentifiers) {
    throw new BadRequestException(`Le systeme ${params.code} doit activer hasIdentifiers=true.`);
  }

  if (!Number.isInteger(params.identifiersPerDevice) || params.identifiersPerDevice <= 0) {
    throw new BadRequestException('identifiersPerDevice doit etre un entier strictement positif.');
  }

  const resolvedIdentifierType = params.identifierType ?? expectedIdentifierType;
  if (resolvedIdentifierType !== expectedIdentifierType) {
    throw new BadRequestException(
      `Type incompatible pour ${params.code}. Type attendu: ${expectedIdentifierType}.`,
    );
  }

  return {
    hasIdentifiers: true,
    identifiersPerDevice: params.identifiersPerDevice,
    identifierType: resolvedIdentifierType,
  };
}

function getDefaultPricing(code: HardwareSystemCode): {
  deviceUnitPriceCents: number;
  extensionUnitPriceCents: number;
  currency: string;
} {
  switch (code) {
    case HardwareSystemCode.RFID_PRESENCE:
      return { deviceUnitPriceCents: 21000, extensionUnitPriceCents: 1000, currency: 'XOF' };
    case HardwareSystemCode.RFID_PORTE:
      return { deviceUnitPriceCents: 20000, extensionUnitPriceCents: 1000, currency: 'XOF' };
    case HardwareSystemCode.BIOMETRIE:
      return { deviceUnitPriceCents: 20000, extensionUnitPriceCents: 1000, currency: 'XOF' };
    case HardwareSystemCode.FEEDBACK:
      return { deviceUnitPriceCents: 15000, extensionUnitPriceCents: 0, currency: 'XOF' };
    default:
      return { deviceUnitPriceCents: 0, extensionUnitPriceCents: 0, currency: 'XOF' };
  }
}

function sanitizePricingConfiguration(params: {
  code: HardwareSystemCode;
  deviceUnitPriceCents?: number | null;
  extensionUnitPriceCents?: number | null;
  currency?: string | null;
}): {
  deviceUnitPriceCents: number;
  extensionUnitPriceCents: number;
  currency: string;
} {
  const defaults = getDefaultPricing(params.code);
  const deviceUnitPriceCents = params.deviceUnitPriceCents ?? defaults.deviceUnitPriceCents;
  const extensionUnitPriceCents =
    params.code === HardwareSystemCode.FEEDBACK
      ? 0
      : (params.extensionUnitPriceCents ?? defaults.extensionUnitPriceCents);
  const currency = (params.currency ?? defaults.currency).trim().toUpperCase();

  if (!Number.isInteger(deviceUnitPriceCents) || deviceUnitPriceCents < 0) {
    throw new BadRequestException('deviceUnitPriceCents doit etre un entier >= 0.');
  }

  if (!Number.isInteger(extensionUnitPriceCents) || extensionUnitPriceCents < 0) {
    throw new BadRequestException('extensionUnitPriceCents doit etre un entier >= 0.');
  }

  if (currency.length !== 3) {
    throw new BadRequestException('currency doit contenir exactement 3 caracteres.');
  }

  return {
    deviceUnitPriceCents,
    extensionUnitPriceCents,
    currency,
  };
}

@Injectable()
export class BusinessSystemsService {
  constructor(private readonly businessSystemsRepository: BusinessSystemsRepository) {}

  listAdminSystems(): Promise<BusinessSystem[]> {
    return this.businessSystemsRepository.findMany();
  }

  listActiveSystems(): Promise<BusinessSystem[]> {
    return this.businessSystemsRepository.findMany({ isActive: true });
  }

  async createSystem(dto: CreateBusinessSystemDto): Promise<BusinessSystem> {
    const normalized = sanitizeIdentifiersConfiguration({
      code: dto.code,
      hasIdentifiers: dto.hasIdentifiers,
      identifiersPerDevice: dto.identifiersPerDevice,
      identifierType: dto.identifierType ?? null,
    });
    const pricing = sanitizePricingConfiguration({
      code: dto.code,
      deviceUnitPriceCents: dto.deviceUnitPriceCents,
      extensionUnitPriceCents: dto.extensionUnitPriceCents,
      currency: dto.currency,
    });

    try {
      return await this.businessSystemsRepository.create({
        name: dto.name,
        code: dto.code,
        hasIdentifiers: normalized.hasIdentifiers,
        identifiersPerDevice: normalized.identifiersPerDevice,
        identifierType: normalized.identifierType,
        deviceUnitPriceCents: pricing.deviceUnitPriceCents,
        extensionUnitPriceCents: pricing.extensionUnitPriceCents,
        currency: pricing.currency,
        isActive: dto.isActive ?? true,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ce systeme existe deja.');
      }
      throw error;
    }
  }

  async setSystemActivation(id: string, isActive: boolean): Promise<BusinessSystem> {
    await this.getSystemByIdOrThrow(id);
    return this.businessSystemsRepository.updateById(id, { isActive });
  }

  async setSystemPricing(id: string, dto: UpdateBusinessSystemPricingDto): Promise<BusinessSystem> {
    const system = await this.getSystemByIdOrThrow(id);
    const pricing = sanitizePricingConfiguration({
      code: system.code,
      deviceUnitPriceCents: dto.deviceUnitPriceCents,
      extensionUnitPriceCents: dto.extensionUnitPriceCents,
      currency: dto.currency ?? system.currency,
    });

    return this.businessSystemsRepository.updateById(id, {
      deviceUnitPriceCents: pricing.deviceUnitPriceCents,
      extensionUnitPriceCents: pricing.extensionUnitPriceCents,
      currency: pricing.currency,
    });
  }

  async getSystemByIdOrThrow(id: string): Promise<BusinessSystem> {
    const system = await this.businessSystemsRepository.findById(id);
    if (!system) {
      throw new NotFoundException('Systeme introuvable.');
    }
    return system;
  }

  async getSystemByCodeOrThrow(code: HardwareSystemCode, mustBeActive = true): Promise<BusinessSystem> {
    const system = await this.businessSystemsRepository.findByCode(code);
    if (!system) {
      throw new NotFoundException('Systeme introuvable.');
    }

    if (mustBeActive && !system.isActive) {
      throw new BadRequestException('Ce systeme est inactif.');
    }

    return system;
  }
}
