import {
  MARKETPLACE_ROUTES,
  SERVICES_ROUTES,
  SYSTEM_ROUTES,
  toMarketplaceState,
  toMarketplaceStatePayloadForApi,
  toServicesState,
  toServicesStatePayloadForApi,
} from './contracts';
import { systemApiClient, toApiErrorMessage } from './httpClient';
import type { MarketplaceStatePayload, ServicesStatePayload } from './types';

export const systemStoreService = {
  async fetchMarketplaceState(): Promise<MarketplaceStatePayload> {
    try {
      const response = await systemApiClient.get<unknown>(MARKETPLACE_ROUTES.state);
      return toMarketplaceState(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Impossible de charger l etat Marketplace.'));
    }
  },

  async saveMarketplaceState(payload: MarketplaceStatePayload): Promise<void> {
    try {
      await systemApiClient.put(
        SYSTEM_ROUTES.marketplaceState,
        toMarketplaceStatePayloadForApi(payload),
      );
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Impossible de sauvegarder l etat Marketplace.'));
    }
  },

  async fetchServicesState(): Promise<ServicesStatePayload> {
    try {
      const response = await systemApiClient.get<unknown>(SERVICES_ROUTES.state);
      return toServicesState(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Impossible de charger l etat Services.'));
    }
  },

  async saveServicesState(payload: ServicesStatePayload): Promise<void> {
    try {
      await systemApiClient.put(
        SYSTEM_ROUTES.servicesState,
        toServicesStatePayloadForApi(payload),
      );
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Impossible de sauvegarder l etat Services.'));
    }
  },
};
