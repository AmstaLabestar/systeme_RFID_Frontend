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

interface MarketplaceSystemStock {
  code?: string;
  availableDevices?: number;
  availableExtensions?: number;
}

function createIdempotencyKey(productId: string, quantity: number): string {
  const bucket = Math.floor(Date.now() / 10_000);
  return `order:${productId}:${quantity}:${bucket}`;
}

function getStockMapFromSystems(catalog: Product[], rawSystems: unknown): Record<string, number | null> {
  const systems = Array.isArray(rawSystems) ? (rawSystems as MarketplaceSystemStock[]) : [];
  const stockByProductId = new Map<string, number>();

  systems.forEach((system) => {
    const normalizedCode = String(system.code ?? '').trim().toLowerCase();
    const moduleByCode: Record<string, ModuleKey> = {
      rfid_presence: 'rfid-presence',
      rfid_porte: 'rfid-porte',
      biometrie: 'biometrie',
      feedback: 'feedback',
    };
    const module = moduleByCode[normalizedCode];
    if (!module) {
      return;
    }

    stockByProductId.set(`device-${module}`, Math.max(Number(system.availableDevices ?? 0), 0));
    if (module !== 'feedback') {
      stockByProductId.set(
        `identifier-extension-${module}`,
        Math.max(Number(system.availableExtensions ?? 0), 0),
      );
    }
  });

  return catalog.reduce<Record<string, number | null>>((accumulator, product) => {
    const stock = stockByProductId.get(product.id);
    accumulator[product.id] = typeof stock === 'number' ? stock : null;
    return accumulator;
  }, {});
}

export const marketplaceService = {
  async fetchCatalog(): Promise<Product[]> {
    try {
      const response = await systemApiClient.get<unknown>(MARKETPLACE_ROUTES.systems);
      return toProductList(response.data);
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Impossible de charger les systemes du marketplace.'));
    }
  },

  async fetchMarketplaceState(): Promise<MarketplaceStatePayload> {
    try {
      const [catalogResponse, devicesResponse] = await Promise.all([
        systemApiClient.get<unknown>(MARKETPLACE_ROUTES.systems),
        systemApiClient.get<unknown>(MARKETPLACE_ROUTES.state),
      ]);
      const catalog = toProductList(catalogResponse.data);
      const state = toMarketplaceState(devicesResponse.data);

      return {
        ...state,
        productStockById: getStockMapFromSystems(catalog, catalogResponse.data),
      };
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Impossible de charger l etat marketplace.'));
    }
  },

  async purchaseProduct(payload: { productId: string; quantity: number }): Promise<PurchaseProductResponse> {
    try {
      const idempotencyKey = createIdempotencyKey(payload.productId, payload.quantity);
      const response = await systemApiClient.post<unknown>(
        MARKETPLACE_ROUTES.orders,
        toPurchasePayload(payload),
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        },
      );
      const purchase = toPurchaseResponse(response.data);
      const refreshedState = await this.fetchMarketplaceState();

      return {
        purchaseId: purchase.purchaseId,
        createdDevices: purchase.createdDevices,
        createdIdentifiers: purchase.createdIdentifiers,
        redirectModule: purchase.redirectModule,
        marketplaceState: refreshedState,
      };
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Achat impossible.'));
    }
  },

  async activateDevice(deviceId: string, input: DeviceConfigurationInput): Promise<ActivateDeviceResponse> {
    try {
      const response = await systemApiClient.patch<unknown>(
        MARKETPLACE_ROUTES.activateDevice(deviceId),
        toActivateDevicePayload(input),
      );
      const activation = toActivateDeviceResponse(response.data);
      const refreshedState = await this.fetchMarketplaceState();

      return {
        device: activation.device,
        marketplaceState: refreshedState,
      };
    } catch (error) {
      throw new Error(toApiErrorMessage(error, 'Activation impossible.'));
    }
  },
};
