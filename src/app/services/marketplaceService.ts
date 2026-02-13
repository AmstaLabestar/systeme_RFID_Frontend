import type { DeviceConfigurationInput, ModuleKey, Product, PurchaseResult } from '@/app/types';
import {
  MARKETPLACE_ROUTES,
  toActivateDevicePayload,
  toActivateDeviceResponse,
  toMarketplaceState,
  toProductList,
  toPurchasePayload,
  toPurchaseResponse,
} from './contracts';
import { systemApiClient, toApiErrorMessage } from './httpClient';
import type { MarketplaceStatePayload } from './types';

export interface PurchaseProductResponse {
  purchaseId: string;
  createdDevices: PurchaseResult['createdDevices'];
  createdIdentifiers: PurchaseResult['createdIdentifiers'];
  redirectModule: ModuleKey;
  marketplaceState: MarketplaceStatePayload;
}

export interface ActivateDeviceResponse {
  device: PurchaseResult['createdDevices'][number];
  marketplaceState: MarketplaceStatePayload;
}

export const marketplaceService = {
  async fetchCatalog(): Promise<Product[]> {
    try {
      const response = await systemApiClient.get<unknown>(MARKETPLACE_ROUTES.catalog);
      return toProductList(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Impossible de charger le catalogue.'));
    }
  },

  async fetchMarketplaceState(): Promise<MarketplaceStatePayload> {
    try {
      const response = await systemApiClient.get<unknown>(MARKETPLACE_ROUTES.state);
      return toMarketplaceState(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Impossible de charger l etat Marketplace.'));
    }
  },

  async purchaseProduct(payload: { productId: string; quantity: number }): Promise<PurchaseProductResponse> {
    try {
      const response = await systemApiClient.post<unknown>(
        MARKETPLACE_ROUTES.purchases,
        toPurchasePayload(payload),
      );
      return toPurchaseResponse(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Achat impossible.'));
    }
  },

  async activateDevice(deviceId: string, input: DeviceConfigurationInput): Promise<ActivateDeviceResponse> {
    try {
      const response = await systemApiClient.post<unknown>(
        MARKETPLACE_ROUTES.activateDevice(deviceId),
        toActivateDevicePayload(input),
      );
      return toActivateDeviceResponse(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Activation impossible.'));
    }
  },
};
