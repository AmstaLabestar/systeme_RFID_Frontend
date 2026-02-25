import axios from 'axios';
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

export type MarketplaceCheckoutErrorCode =
  | 'OUT_OF_STOCK'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NETWORK'
  | 'SERVER'
  | 'UNKNOWN';

export class MarketplaceCheckoutError extends Error {
  code: MarketplaceCheckoutErrorCode;
  status?: number;
  retryable: boolean;

  constructor(params: {
    code: MarketplaceCheckoutErrorCode;
    message: string;
    status?: number;
    retryable?: boolean;
  }) {
    super(params.message);
    this.name = 'MarketplaceCheckoutError';
    this.code = params.code;
    this.status = params.status;
    this.retryable = params.retryable ?? false;
  }
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

function toCheckoutError(error: unknown): MarketplaceCheckoutError {
  const fallbackMessage = 'Achat impossible.';

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = toApiErrorMessage(error, fallbackMessage);
    const normalized = message.trim().toLowerCase();

    if (error.code === 'ERR_NETWORK') {
      return new MarketplaceCheckoutError({
        code: 'NETWORK',
        message:
          'Connexion impossible au serveur. Verifiez votre reseau puis reessayez dans quelques instants.',
        status,
        retryable: true,
      });
    }

    if (status === 401) {
      return new MarketplaceCheckoutError({
        code: 'UNAUTHORIZED',
        message: 'Votre session a expire. Reconnectez-vous puis relancez la commande.',
        status,
      });
    }

    if (status === 403) {
      return new MarketplaceCheckoutError({
        code: 'FORBIDDEN',
        message: 'Vous n avez pas les droits necessaires pour effectuer cet achat.',
        status,
      });
    }

    const stockSignals = ['stock', 'insuffisant', 'epuise', 'rupture'];
    if (
      stockSignals.some((signal) => normalized.includes(signal)) &&
      (status === 400 || status === 409 || status === 422)
    ) {
      return new MarketplaceCheckoutError({
        code: 'OUT_OF_STOCK',
        message: 'Stock insuffisant pour cette quantite. Ajustez la quantite puis reessayez.',
        status,
      });
    }

    if (status === 409 || normalized.includes('conflit')) {
      return new MarketplaceCheckoutError({
        code: 'CONFLICT',
        message:
          'La commande est en conflit avec un achat simultane. Rafraichissez puis reessayez.',
        status,
        retryable: true,
      });
    }

    if (status === 400 || status === 422) {
      return new MarketplaceCheckoutError({
        code: 'VALIDATION',
        message,
        status,
      });
    }

    if (status && status >= 500) {
      return new MarketplaceCheckoutError({
        code: 'SERVER',
        message: 'Le serveur a rencontre une erreur temporaire. Reessayez dans quelques instants.',
        status,
        retryable: true,
      });
    }

    return new MarketplaceCheckoutError({
      code: 'UNKNOWN',
      message,
      status,
    });
  }

  if (error instanceof MarketplaceCheckoutError) {
    return error;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new MarketplaceCheckoutError({
      code: 'UNKNOWN',
      message: error.message,
    });
  }

  return new MarketplaceCheckoutError({
    code: 'UNKNOWN',
    message: fallbackMessage,
  });
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
      throw toCheckoutError(error);
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
