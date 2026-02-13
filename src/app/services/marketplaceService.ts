import { MARKETPLACE_CATALOG } from '@/app/data';
import type { Product } from '@/app/types';
import { delay } from './utils';

export interface PurchaseSimulationRequest {
  product: Product;
  quantity: number;
  remainingStock: number | null;
}

export interface PurchaseSimulationResponse {
  acceptedAt: string;
  remainingStock: number | null;
}

export interface ActivateDeviceSimulationRequest {
  provisionedMacAddress: string;
  requestedSystemIdentifier: string;
}

export interface ActivateDeviceSimulationResponse {
  activatedAt: string;
  systemIdentifier: string;
}

function normalizeMacAddress(value: string): string {
  return value.trim().toUpperCase().replaceAll('-', ':');
}

export const marketplaceService = {
  async fetchCatalog(): Promise<Product[]> {
    await delay(200);
    return MARKETPLACE_CATALOG;
  },

  // Mock endpoint: replace by POST /marketplace/purchase once backend is ready.
  async simulatePurchase(request: PurchaseSimulationRequest): Promise<PurchaseSimulationResponse> {
    await delay(260);

    if (!Number.isInteger(request.quantity) || request.quantity < 1) {
      throw new Error('La quantite doit etre superieure a 0.');
    }

    if (request.remainingStock !== null && request.quantity > request.remainingStock) {
      throw new Error('Stock materiel insuffisant pour ce boitier.');
    }

    return {
      acceptedAt: new Date().toISOString(),
      remainingStock:
        request.remainingStock === null
          ? null
          : Math.max(request.remainingStock - request.quantity, 0),
    };
  },

  // Mock endpoint: replace by POST /devices/:id/activate once backend is ready.
  async simulateDeviceActivation(
    request: ActivateDeviceSimulationRequest,
  ): Promise<ActivateDeviceSimulationResponse> {
    await delay(220);

    const provisionedMac = normalizeMacAddress(request.provisionedMacAddress);
    const requestedMac = normalizeMacAddress(request.requestedSystemIdentifier);

    if (!requestedMac) {
      throw new Error('Adresse MAC requise pour activer le boitier.');
    }

    if (requestedMac !== provisionedMac) {
      throw new Error('La MAC saisie ne correspond pas a la MAC livree avec le boitier.');
    }

    return {
      activatedAt: new Date().toISOString(),
      systemIdentifier: requestedMac,
    };
  },
};
