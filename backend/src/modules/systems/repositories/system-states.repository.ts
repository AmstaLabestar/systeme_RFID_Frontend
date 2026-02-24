import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { MarketplaceStatePayload, ServicesStatePayload } from '../domain/system-state.types';

interface MarketplaceStateRecord {
  userId: string;
  productStockById: Prisma.JsonValue;
  devices: Prisma.JsonValue;
  inventory: Prisma.JsonValue;
}

interface ServicesStateRecord {
  userId: string;
  employees: Prisma.JsonValue;
  assignments: Prisma.JsonValue;
  history: Prisma.JsonValue;
  feedbackRecords: Prisma.JsonValue;
}

function asInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class SystemStatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMarketplaceStateByUserId(userId: string): Promise<MarketplaceStateRecord | null> {
    return this.prisma.marketplaceState.findUnique({
      where: { userId },
      select: {
        userId: true,
        productStockById: true,
        devices: true,
        inventory: true,
      },
    });
  }

  findServicesStateByUserId(userId: string): Promise<ServicesStateRecord | null> {
    return this.prisma.servicesState.findUnique({
      where: { userId },
      select: {
        userId: true,
        employees: true,
        assignments: true,
        history: true,
        feedbackRecords: true,
      },
    });
  }

  async upsertMarketplaceState(
    userId: string,
    payload: MarketplaceStatePayload,
  ): Promise<MarketplaceStateRecord> {
    return this.prisma.marketplaceState.upsert({
      where: { userId },
      update: {
        productStockById: asInputJson(payload.productStockById),
        devices: asInputJson(payload.devices),
        inventory: asInputJson(payload.inventory),
      },
      create: {
        user: { connect: { id: userId } },
        productStockById: asInputJson(payload.productStockById),
        devices: asInputJson(payload.devices),
        inventory: asInputJson(payload.inventory),
      },
      select: {
        userId: true,
        productStockById: true,
        devices: true,
        inventory: true,
      },
    });
  }

  async upsertServicesState(userId: string, payload: ServicesStatePayload): Promise<ServicesStateRecord> {
    return this.prisma.servicesState.upsert({
      where: { userId },
      update: {
        employees: asInputJson(payload.employees),
        assignments: asInputJson(payload.assignments),
        history: asInputJson(payload.history),
        feedbackRecords: asInputJson(payload.feedbackRecords),
      },
      create: {
        user: { connect: { id: userId } },
        employees: asInputJson(payload.employees),
        assignments: asInputJson(payload.assignments),
        history: asInputJson(payload.history),
        feedbackRecords: asInputJson(payload.feedbackRecords),
      },
      select: {
        userId: true,
        employees: true,
        assignments: true,
        history: true,
        feedbackRecords: true,
      },
    });
  }

  listMarketplaceStateSnapshots(): Promise<Array<{ userId: string; devices: Prisma.JsonValue }>> {
    return this.prisma.marketplaceState.findMany({
      select: {
        userId: true,
        devices: true,
      },
    });
  }
}
