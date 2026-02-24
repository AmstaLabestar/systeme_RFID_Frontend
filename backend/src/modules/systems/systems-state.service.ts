import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createDefaultMarketplaceState, createDefaultServicesState } from './domain/system-state.constants';
import { normalizeDeviceCollection, normalizeMarketplaceState, normalizeServicesState } from './domain/system-state.utils';
import type {
  DeviceUnit,
  MarketplaceStatePayload,
  ServicesStatePayload,
  SystemsStatePayload,
} from './domain/system-state.types';
import { SystemStatesRepository } from './repositories/system-states.repository';

@Injectable()
export class SystemsStateService {
  constructor(private readonly systemStatesRepository: SystemStatesRepository) {}

  async getSystemsState(userId: string): Promise<SystemsStatePayload> {
    const [marketplace, services] = await Promise.all([
      this.getMarketplaceState(userId),
      this.getServicesState(userId),
    ]);

    return {
      marketplace,
      services,
    };
  }

  async getMarketplaceState(userId: string): Promise<MarketplaceStatePayload> {
    const existing = await this.systemStatesRepository.findMarketplaceStateByUserId(userId);

    if (!existing) {
      return this.saveMarketplaceState(userId, createDefaultMarketplaceState());
    }

    return normalizeMarketplaceState({
      productStockById: existing.productStockById,
      devices: existing.devices,
      inventory: existing.inventory,
    });
  }

  async saveMarketplaceState(
    userId: string,
    payload: unknown,
  ): Promise<MarketplaceStatePayload> {
    const normalized = normalizeMarketplaceState(payload);

    try {
      await this.systemStatesRepository.upsertMarketplaceState(userId, normalized);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2025')
      ) {
        throw error;
      }
      throw error;
    }

    return normalized;
  }

  async getServicesState(userId: string): Promise<ServicesStatePayload> {
    const existing = await this.systemStatesRepository.findServicesStateByUserId(userId);

    if (!existing) {
      return this.saveServicesState(userId, createDefaultServicesState());
    }

    return normalizeServicesState({
      employees: existing.employees,
      assignments: existing.assignments,
      history: existing.history,
      feedbackRecords: existing.feedbackRecords,
    });
  }

  async saveServicesState(userId: string, payload: unknown): Promise<ServicesStatePayload> {
    const normalized = normalizeServicesState(payload);

    try {
      await this.systemStatesRepository.upsertServicesState(userId, normalized);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2025')
      ) {
        throw error;
      }
      throw error;
    }

    return normalized;
  }

  async collectFeedbackQrTokens(): Promise<Set<string>> {
    const snapshots = await this.systemStatesRepository.listMarketplaceStateSnapshots();
    const tokens = new Set<string>();

    snapshots.forEach((snapshot) => {
      const devices = normalizeDeviceCollection(snapshot.devices);

      devices.forEach((device) => {
        if (device.module !== 'feedback' || !device.qrToken) {
          return;
        }

        const token = device.qrToken.trim();
        if (token) {
          tokens.add(token);
        }
      });
    });

    return tokens;
  }

  async findFeedbackDeviceByQrToken(
    qrToken: string,
  ): Promise<{ userId: string; device: DeviceUnit } | null> {
    const normalizedToken = qrToken.trim();

    if (!normalizedToken) {
      return null;
    }

    const snapshots = await this.systemStatesRepository.listMarketplaceStateSnapshots();

    for (const snapshot of snapshots) {
      const devices = normalizeDeviceCollection(snapshot.devices);
      const found = devices.find(
        (candidate) =>
          candidate.module === 'feedback' &&
          typeof candidate.qrToken === 'string' &&
          candidate.qrToken.trim() === normalizedToken,
      );

      if (found) {
        return {
          userId: snapshot.userId,
          device: found,
        };
      }
    }

    return null;
  }
}
