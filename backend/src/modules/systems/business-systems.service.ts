import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HardwareSystemCode, type BusinessSystem, type IdentifierType, Prisma } from '@prisma/client';
import { CreateBusinessSystemDto } from './dto/create-business-system.dto';
import { BusinessSystemsRepository } from './repositories/business-systems.repository';

function sanitizeIdentifiersConfiguration(params: {
  hasIdentifiers: boolean;
  identifiersPerDevice: number;
  identifierType?: IdentifierType | null;
}): { identifiersPerDevice: number; identifierType: IdentifierType | null } {
  if (!params.hasIdentifiers) {
    return {
      identifiersPerDevice: 0,
      identifierType: null,
    };
  }

  if (!params.identifierType) {
    throw new BadRequestException('identifierType est obligatoire quand hasIdentifiers=true.');
  }

  if (!Number.isInteger(params.identifiersPerDevice) || params.identifiersPerDevice <= 0) {
    throw new BadRequestException('identifiersPerDevice doit etre un entier strictement positif.');
  }

  return {
    identifiersPerDevice: params.identifiersPerDevice,
    identifierType: params.identifierType,
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
      hasIdentifiers: dto.hasIdentifiers,
      identifiersPerDevice: dto.identifiersPerDevice,
      identifierType: dto.identifierType ?? null,
    });

    try {
      return await this.businessSystemsRepository.create({
        name: dto.name,
        code: dto.code,
        hasIdentifiers: dto.hasIdentifiers,
        identifiersPerDevice: normalized.identifiersPerDevice,
        identifierType: normalized.identifierType,
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
