import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { IDENTIFIER_LABELS } from '@/app/data';
import { marketplaceService, queryKeys } from '@/app/services';
import { useAuth } from '@/app/contexts/auth';
import { useNotifications } from '@/app/contexts/notifications';
import type {
  DeviceConfigurationInput,
  DeviceUnit,
  InventoryIdentifier,
  ModuleKey,
  Product,
  PurchaseResult,
} from '@/app/types';

interface MarketplaceStateSnapshot {
  productStockById: Record<string, number | null>;
  devices: DeviceUnit[];
  inventory: InventoryIdentifier[];
}

interface MarketplaceContextValue {
  catalog: Product[];
  deviceProducts: Product[];
  identifierProducts: Product[];
  devices: DeviceUnit[];
  inventory: InventoryIdentifier[];
  isLoadingCatalog: boolean;
  isPurchasing: boolean;
  purchaseProduct: (productId: string, quantity: number) => Promise<PurchaseResult>;
  configureDevice: (deviceId: string, input: DeviceConfigurationInput) => Promise<void>;
  applyMarketplaceState: (state: MarketplaceStateSnapshot) => void;
  getDevicesByModule: (module: ModuleKey, configuredOnly?: boolean) => DeviceUnit[];
  getAvailableIdentifiersByModule: (module: ModuleKey) => InventoryIdentifier[];
  getInventoryById: (identifierId: string) => InventoryIdentifier | undefined;
  getProductRemainingStock: (productId: string) => number | null;
  isProductSoldOut: (productId: string) => boolean;
  isModuleEnabled: (module: ModuleKey) => boolean;
}

const MarketplaceContext = createContext<MarketplaceContextValue | undefined>(undefined);

function createInitialStockMap(products: Product[]): Record<string, number | null> {
  return products.reduce<Record<string, number | null>>((accumulator, product) => {
    accumulator[product.id] = typeof product.stockLimit === 'number' ? product.stockLimit : null;
    return accumulator;
  }, {});
}

function mergeStockWithCatalog(
  products: Product[],
  stockCandidate?: Record<string, number | null>,
): Record<string, number | null> {
  const initialStock = createInitialStockMap(products);

  if (!stockCandidate) {
    return initialStock;
  }

  return products.reduce<Record<string, number | null>>((accumulator, product) => {
    const initialValue = initialStock[product.id];
    const candidateValue = stockCandidate[product.id];

    if (typeof initialValue === 'number' && typeof candidateValue === 'number') {
      accumulator[product.id] = Math.min(Math.max(candidateValue, 0), initialValue);
      return accumulator;
    }

    accumulator[product.id] = initialValue;
    return accumulator;
  }, {});
}

function isProductAvailable(product: Product, stockById: Record<string, number | null>): boolean {
  const remainingStock = stockById[product.id];
  return remainingStock === null || remainingStock > 0;
}

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const userScope = user?.id ?? 'guest';

  const catalogQuery = useQuery({
    queryKey: queryKeys.marketplace.catalog(),
    queryFn: marketplaceService.fetchCatalog,
    enabled: Boolean(user),
  });

  const marketplaceStateQuery = useQuery({
    queryKey: queryKeys.marketplace.state(userScope),
    queryFn: marketplaceService.fetchMarketplaceState,
    enabled: Boolean(user),
  });

  const fullCatalog = catalogQuery.data ?? [];
  const rawMarketplaceState = marketplaceStateQuery.data;

  const productStockById = useMemo(
    () => mergeStockWithCatalog(fullCatalog, rawMarketplaceState?.productStockById),
    [fullCatalog, rawMarketplaceState?.productStockById],
  );
  const devices = rawMarketplaceState?.devices ?? [];
  const inventory = rawMarketplaceState?.inventory ?? [];
  const catalog = useMemo(
    () => fullCatalog.filter((product) => isProductAvailable(product, productStockById)),
    [fullCatalog, productStockById],
  );

  const deviceProducts = useMemo(() => catalog.filter((product) => product.kind === 'device'), [catalog]);
  const identifierProducts = useMemo(
    () => catalog.filter((product) => product.kind === 'identifier-pack'),
    [catalog],
  );

  const applyMarketplaceState = useCallback(
    (state: MarketplaceStateSnapshot) => {
      queryClient.setQueryData(queryKeys.marketplace.state(userScope), state);
    },
    [queryClient, userScope],
  );

  const purchaseMutation = useMutation({
    mutationFn: marketplaceService.purchaseProduct,
    onSuccess: (result) => {
      applyMarketplaceState(result.marketplaceState);
    },
  });

  const activateDeviceMutation = useMutation({
    mutationFn: ({ deviceId, input }: { deviceId: string; input: DeviceConfigurationInput }) =>
      marketplaceService.activateDevice(deviceId, input),
    onSuccess: (result) => {
      applyMarketplaceState(result.marketplaceState);
    },
  });

  const purchaseProduct = useCallback(
    async (productId: string, quantity: number): Promise<PurchaseResult> => {
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error('La quantite doit etre superieure a 0.');
      }

      const product = fullCatalog.find((item) => item.id === productId);
      if (!product) {
        throw new Error('Produit introuvable.');
      }

      const result = await purchaseMutation.mutateAsync({ productId, quantity });

      const identifierLabel = product.identifierType
        ? IDENTIFIER_LABELS[product.identifierType]
        : 'Identifiants';
      const identifiersPreview = result.createdIdentifiers
        .slice(0, 6)
        .map((identifier) => identifier.code)
        .join(', ');
      const previewSuffix =
        result.createdIdentifiers.length > 6
          ? ` (+${result.createdIdentifiers.length - 6} autres)`
          : '';
      const provisionedMacAddresses = result.createdDevices.map((device) => device.provisionedMacAddress);

      const messageParts = [
        `${quantity}x ${product.label}`,
        provisionedMacAddresses.length > 0
          ? `MAC livree: ${provisionedMacAddresses.join(', ')}`
          : null,
        result.createdIdentifiers.length > 0
          ? `${result.createdIdentifiers.length} ${identifierLabel} crees: ${identifiersPreview}${previewSuffix}`
          : 'Aucun identifiant a provisionner pour ce module.',
      ].filter(Boolean) as string[];

      addNotification({
        title: 'Achat confirme',
        message: messageParts.join(' | '),
        kind: 'success',
        module: product.module,
        withToast: true,
      });

      return {
        purchaseId: result.purchaseId,
        createdDevices: result.createdDevices,
        createdIdentifiers: result.createdIdentifiers,
        redirectModule: result.redirectModule,
      };
    },
    [fullCatalog, purchaseMutation, addNotification],
  );

  const configureDevice = useCallback(
    async (deviceId: string, input: DeviceConfigurationInput) => {
      const response = await activateDeviceMutation.mutateAsync({ deviceId, input });

      addNotification({
        title: 'Boitier active',
        message: `${response.device.name} est lie via ${response.device.systemIdentifier} et actif pour ce module.`,
        kind: 'success',
        module: response.device.module,
        withToast: true,
      });
    },
    [activateDeviceMutation, addNotification],
  );

  const getDevicesByModule = useCallback(
    (module: ModuleKey, configuredOnly = false): DeviceUnit[] =>
      devices.filter((device) => device.module === module && (!configuredOnly || device.configured)),
    [devices],
  );

  const getAvailableIdentifiersByModule = useCallback(
    (module: ModuleKey): InventoryIdentifier[] =>
      inventory.filter((identifier) => identifier.module === module && identifier.status === 'available'),
    [inventory],
  );

  const getInventoryById = useCallback(
    (identifierId: string): InventoryIdentifier | undefined =>
      inventory.find((identifier) => identifier.id === identifierId),
    [inventory],
  );

  const getProductRemainingStock = useCallback(
    (productId: string): number | null => {
      const remainingStock = productStockById[productId];
      return typeof remainingStock === 'number' ? remainingStock : null;
    },
    [productStockById],
  );

  const isProductSoldOut = useCallback(
    (productId: string): boolean => {
      const remainingStock = getProductRemainingStock(productId);
      return remainingStock !== null && remainingStock <= 0;
    },
    [getProductRemainingStock],
  );

  const isModuleEnabled = useCallback(
    (module: ModuleKey): boolean => devices.some((device) => device.module === module),
    [devices],
  );

  const value = useMemo(
    () => ({
      catalog,
      deviceProducts,
      identifierProducts,
      devices,
      inventory,
      isLoadingCatalog: catalogQuery.isLoading || marketplaceStateQuery.isLoading,
      isPurchasing: purchaseMutation.isPending,
      purchaseProduct,
      configureDevice,
      applyMarketplaceState,
      getDevicesByModule,
      getAvailableIdentifiersByModule,
      getInventoryById,
      getProductRemainingStock,
      isProductSoldOut,
      isModuleEnabled,
    }),
    [
      catalog,
      deviceProducts,
      identifierProducts,
      devices,
      inventory,
      catalogQuery.isLoading,
      marketplaceStateQuery.isLoading,
      purchaseMutation.isPending,
      purchaseProduct,
      configureDevice,
      applyMarketplaceState,
      getDevicesByModule,
      getAvailableIdentifiersByModule,
      getInventoryById,
      getProductRemainingStock,
      isProductSoldOut,
      isModuleEnabled,
    ],
  );

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}

export function useMarketplace(): MarketplaceContextValue {
  const context = useContext(MarketplaceContext);

  if (!context) {
    throw new Error('useMarketplace must be used within MarketplaceProvider.');
  }

  return context;
}
