import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  IDENTIFIER_LABELS,
  MODULE_LABELS,
  MARKETPLACE_CATALOG,
} from '@/app/data';
import { marketplaceService } from '@/app/services';
import { createId, identifierPrefixes } from '@/app/services';
import { useNotifications } from '@/app/contexts/notifications';
import type {
  DeviceConfigurationInput,
  DeviceUnit,
  IdentifierType,
  InventoryIdentifier,
  ModuleKey,
  Product,
  PurchaseResult,
} from '@/app/types';

interface AssignIdentifierPayload {
  module: ModuleKey;
  deviceId: string;
  identifierId: string;
  employeeId: string;
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
  assignIdentifierToEmployee: (payload: AssignIdentifierPayload) => InventoryIdentifier;
  releaseIdentifier: (identifierId: string) => InventoryIdentifier;
  getDevicesByModule: (module: ModuleKey, configuredOnly?: boolean) => DeviceUnit[];
  getAvailableIdentifiersByModule: (module: ModuleKey) => InventoryIdentifier[];
  getInventoryById: (identifierId: string) => InventoryIdentifier | undefined;
  getProductRemainingStock: (productId: string) => number | null;
  isProductSoldOut: (productId: string) => boolean;
  isModuleEnabled: (module: ModuleKey) => boolean;
}

const MarketplaceContext = createContext<MarketplaceContextValue | undefined>(undefined);

const identifierCounterSeed: Record<IdentifierType, number> = {
  'badge-rfid': 1000,
  empreinte: 3000,
  'serrure-rfid': 2000,
};

const deviceCounterSeed: Record<ModuleKey, number> = {
  'rfid-presence': 0,
  'rfid-porte': 0,
  biometrie: 0,
  feedback: 0,
};

const deviceMacCounterSeed: Record<ModuleKey, number> = {
  'rfid-presence': 0,
  'rfid-porte': 0,
  biometrie: 0,
  feedback: 0,
};

const moduleMacSegment: Record<ModuleKey, number> = {
  'rfid-presence': 0x31,
  'rfid-porte': 0x32,
  biometrie: 0x33,
  feedback: 0x34,
};

const MAC_ADDRESS_REGEX = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
const MARKETPLACE_STOCK_STORAGE_KEY = 'rfid.marketplace.stock';

function buildDeviceName(module: ModuleKey, index: number): string {
  const moduleLabel = MODULE_LABELS[module];
  return `Boitier ${moduleLabel} #${index}`;
}

function normalizeSystemIdentifier(value: string): string {
  return value.trim().toUpperCase().replaceAll('-', ':');
}

function isValidSystemIdentifier(value: string): boolean {
  return MAC_ADDRESS_REGEX.test(value);
}

function formatHex(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, '0');
}

function buildProvisionedMacAddress(module: ModuleKey, sequence: number): string {
  const moduleSegment = moduleMacSegment[module];
  const high = (sequence >> 8) & 0xff;
  const low = sequence & 0xff;

  return ['AA', '70', formatHex(moduleSegment), formatHex(high), formatHex(low), '01'].join(':');
}

function createInitialStockMap(products: Product[]): Record<string, number | null> {
  return products.reduce<Record<string, number | null>>((accumulator, product) => {
    accumulator[product.id] = typeof product.stockLimit === 'number' ? product.stockLimit : null;
    return accumulator;
  }, {});
}

function readPersistedStock(): Record<string, number | null> | null {
  const rawValue = window.localStorage.getItem(MARKETPLACE_STOCK_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as Record<string, number | null>;
  } catch {
    return null;
  }
}

function buildStockFromCatalogWithPersistence(products: Product[]): Record<string, number | null> {
  const initialStock = createInitialStockMap(products);
  const persistedStock = readPersistedStock();

  if (!persistedStock) {
    return initialStock;
  }

  return products.reduce<Record<string, number | null>>((accumulator, product) => {
    const initialValue = initialStock[product.id];
    const persistedValue = persistedStock[product.id];

    if (typeof initialValue === 'number' && typeof persistedValue === 'number') {
      accumulator[product.id] = Math.min(Math.max(persistedValue, 0), initialValue);
      return accumulator;
    }

    accumulator[product.id] = initialValue;
    return accumulator;
  }, {});
}

function isProductAvailable(
  product: Product,
  stockById: Record<string, number | null>,
): boolean {
  const remainingStock = stockById[product.id];
  return remainingStock === null || remainingStock > 0;
}

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Product[]>(() => {
    const initialStockById = buildStockFromCatalogWithPersistence(MARKETPLACE_CATALOG);
    return MARKETPLACE_CATALOG.filter((product) => isProductAvailable(product, initialStockById));
  });
  const [devices, setDevices] = useState<DeviceUnit[]>([]);
  const [inventory, setInventory] = useState<InventoryIdentifier[]>([]);
  const [productStockById, setProductStockById] = useState<Record<string, number | null>>(() =>
    buildStockFromCatalogWithPersistence(MARKETPLACE_CATALOG),
  );
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const identifierCounters = useRef<Record<IdentifierType, number>>({ ...identifierCounterSeed });
  const deviceCounters = useRef<Record<ModuleKey, number>>({ ...deviceCounterSeed });
  const deviceMacCounters = useRef<Record<ModuleKey, number>>({ ...deviceMacCounterSeed });

  const { addNotification } = useNotifications();

  const deviceProducts = useMemo(() => catalog.filter((product) => product.kind === 'device'), [catalog]);
  const identifierProducts = useMemo(
    () => catalog.filter((product) => product.kind === 'identifier-pack'),
    [catalog],
  );

  useEffect(() => {
    let isMounted = true;

    marketplaceService
      .fetchCatalog()
      .then((response) => {
        if (!isMounted) {
          return;
        }
        const nextStockById = buildStockFromCatalogWithPersistence(response);
        setProductStockById(nextStockById);
        setCatalog(response.filter((product) => isProductAvailable(product, nextStockById)));
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingCatalog(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(MARKETPLACE_STOCK_STORAGE_KEY, JSON.stringify(productStockById));
  }, [productStockById]);

  const nextIdentifierCode = useCallback((type: IdentifierType): string => {
    identifierCounters.current[type] += 1;
    const prefix = identifierPrefixes[type];
    return `${prefix}-${identifierCounters.current[type]}`;
  }, []);

  const nextDeviceIndex = useCallback((module: ModuleKey): number => {
    deviceCounters.current[module] += 1;
    return deviceCounters.current[module];
  }, []);

  const nextProvisionedMacAddress = useCallback((module: ModuleKey): string => {
    deviceMacCounters.current[module] += 1;
    return buildProvisionedMacAddress(module, deviceMacCounters.current[module]);
  }, []);

  const purchaseProduct = useCallback(
    async (productId: string, quantity: number): Promise<PurchaseResult> => {
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error('La quantite doit etre superieure a 0.');
      }

      const product = catalog.find((item) => item.id === productId);

      if (!product) {
        throw new Error('Produit introuvable.');
      }

      const remainingStock = productStockById[product.id] ?? null;

      setIsPurchasing(true);

      try {
        const purchaseSimulation = await marketplaceService.simulatePurchase({
          product,
          quantity,
          remainingStock,
        });

        const createdDevices: DeviceUnit[] = [];
        const createdIdentifiers: InventoryIdentifier[] = [];
        const createdDeviceIdentifierCodes: string[] = [];
        const createdExtensionIdentifierCodes: string[] = [];
        const provisionedMacAddresses: string[] = [];

        if (product.kind === 'device') {
          for (let index = 0; index < quantity; index += 1) {
            const deviceNumber = nextDeviceIndex(product.module);
            const deviceId = createId('device');
            const createdAt = purchaseSimulation.acceptedAt;
            const provisionedMacAddress = nextProvisionedMacAddress(product.module);
            const device: DeviceUnit = {
              id: deviceId,
              module: product.module,
              name: buildDeviceName(product.module, deviceNumber),
              location: 'A configurer',
              provisionedMacAddress,
              configured: false,
              capacity: product.includedIdentifiers ?? 0,
              createdAt,
            };

            createdDevices.push(device);
            provisionedMacAddresses.push(provisionedMacAddress);

            if (product.identifierType && (product.includedIdentifiers ?? 0) > 0) {
              for (let codeIndex = 0; codeIndex < (product.includedIdentifiers ?? 0); codeIndex += 1) {
                const code = nextIdentifierCode(product.identifierType);
                createdIdentifiers.push({
                  id: createId('idn'),
                  module: product.module,
                  type: product.identifierType,
                  code,
                  status: 'available',
                  deviceId: device.id,
                  acquiredAt: createdAt,
                });
                createdDeviceIdentifierCodes.push(code);
              }
            }
          }
        }

        if (product.kind === 'identifier-pack' && product.identifierType && product.quantityPerPack) {
          const count = quantity * product.quantityPerPack;
          for (let index = 0; index < count; index += 1) {
            const code = nextIdentifierCode(product.identifierType);
            createdIdentifiers.push({
              id: createId('idn'),
              module: product.module,
              type: product.identifierType,
              code,
              status: 'available',
              acquiredAt: purchaseSimulation.acceptedAt,
            });
            createdExtensionIdentifierCodes.push(code);
          }
        }

        if (purchaseSimulation.remainingStock !== remainingStock) {
          setProductStockById((currentStockById) => {
            const nextStockById = {
              ...currentStockById,
              [product.id]: purchaseSimulation.remainingStock,
            };

            // In mock mode we remove exhausted items from the in-memory catalog.
            setCatalog((currentCatalog) =>
              currentCatalog.filter((item) => isProductAvailable(item, nextStockById)),
            );

            return nextStockById;
          });
        }

        if (createdDevices.length > 0) {
          setDevices((currentDevices) => [...currentDevices, ...createdDevices]);
        }

        if (createdIdentifiers.length > 0) {
          setInventory((currentInventory) => [...currentInventory, ...createdIdentifiers]);
        }

        const identifierLabel = product.identifierType
          ? IDENTIFIER_LABELS[product.identifierType]
          : 'Identifiants';
        const identifiersPreview = createdIdentifiers
          .slice(0, 6)
          .map((identifier) => identifier.code)
          .join(', ');

        const previewSuffix =
          createdIdentifiers.length > 6
            ? ` (+${createdIdentifiers.length - 6} autres)`
            : '';

        const messageParts = [
          `${quantity}x ${product.label}`,
          provisionedMacAddresses.length > 0
            ? `MAC livree: ${provisionedMacAddresses.join(', ')}`
            : null,
          createdIdentifiers.length > 0
            ? `${createdIdentifiers.length} ${identifierLabel} crees: ${identifiersPreview}${previewSuffix}`
            : 'Aucun identifiant a provisionner pour ce module.',
        ].filter(Boolean) as string[];

        addNotification({
          title: 'Achat confirme',
          message: messageParts.join(' | '),
          kind: 'success',
          module: product.module,
          identifierSections: {
            deviceIdentifiers: createdDeviceIdentifierCodes,
            extensionIdentifiers: createdExtensionIdentifierCodes,
          },
          withToast: true,
        });

        return {
          purchaseId: createId('purchase'),
          createdDevices,
          createdIdentifiers,
          redirectModule: product.module,
        };
      } finally {
        setIsPurchasing(false);
      }
    },
    [catalog, productStockById, nextDeviceIndex, nextIdentifierCode, nextProvisionedMacAddress, addNotification],
  );

  const configureDevice = useCallback(
    async (deviceId: string, input: DeviceConfigurationInput) => {
      const normalizedIdentifier = normalizeSystemIdentifier(input.systemIdentifier);

      if (!isValidSystemIdentifier(normalizedIdentifier)) {
        throw new Error('Identifiant systeme invalide. Utilisez une adresse MAC de type AA:BB:CC:DD:EE:FF.');
      }

      const targetDevice = devices.find((device) => device.id === deviceId);

      if (!targetDevice) {
        throw new Error('Boitier introuvable.');
      }

      if (targetDevice.provisionedMacAddress !== normalizedIdentifier) {
        throw new Error('La MAC fournie ne correspond pas a la MAC livree pour ce boitier.');
      }

      const identifierAlreadyUsed = devices.some(
        (device) =>
          device.id !== deviceId &&
          typeof device.systemIdentifier === 'string' &&
          device.systemIdentifier === normalizedIdentifier,
      );

      if (identifierAlreadyUsed) {
        throw new Error('Cet identifiant systeme est deja lie a un autre boitier.');
      }

      const activation = await marketplaceService.simulateDeviceActivation({
        provisionedMacAddress: targetDevice.provisionedMacAddress,
        requestedSystemIdentifier: normalizedIdentifier,
      });

      let updatedDevice: DeviceUnit | undefined;

      setDevices((currentDevices) =>
        currentDevices.map((device) => {
          if (device.id !== deviceId) {
            return device;
          }

          updatedDevice = {
            ...device,
            configured: true,
            name: input.name.trim(),
            location: input.location.trim(),
            systemIdentifier: activation.systemIdentifier,
            activatedAt: activation.activatedAt,
          };

          return updatedDevice;
        }),
      );

      if (!updatedDevice) {
        throw new Error('Boitier introuvable.');
      }

      addNotification({
        title: 'Boitier active',
        message: `${updatedDevice.name} est lie via ${updatedDevice.systemIdentifier} et actif pour ce module.`,
        kind: 'success',
        module: updatedDevice.module,
        withToast: true,
      });
    },
    [addNotification, devices],
  );

  const assignIdentifierToEmployee = useCallback((payload: AssignIdentifierPayload): InventoryIdentifier => {
    let updatedIdentifier: InventoryIdentifier | undefined;

    setInventory((currentInventory) => {
      const nextInventory = [...currentInventory];
      const identifierIndex = nextInventory.findIndex((identifier) => identifier.id === payload.identifierId);

      if (identifierIndex === -1) {
        throw new Error('Identifiant introuvable dans l inventaire.');
      }

      const currentIdentifier = nextInventory[identifierIndex];

      if (currentIdentifier.module !== payload.module) {
        throw new Error('Cet identifiant n est pas compatible avec ce module.');
      }

      if (currentIdentifier.status === 'assigned') {
        throw new Error('Cet identifiant est deja attribue.');
      }

      updatedIdentifier = {
        ...currentIdentifier,
        status: 'assigned',
        employeeId: payload.employeeId,
        deviceId: payload.deviceId,
      };

      nextInventory[identifierIndex] = updatedIdentifier;
      return nextInventory;
    });

    if (!updatedIdentifier) {
      throw new Error('Impossible d assigner cet identifiant.');
    }

    return updatedIdentifier;
  }, []);

  const releaseIdentifier = useCallback((identifierId: string): InventoryIdentifier => {
    let updatedIdentifier: InventoryIdentifier | undefined;

    setInventory((currentInventory) => {
      const nextInventory = [...currentInventory];
      const identifierIndex = nextInventory.findIndex((identifier) => identifier.id === identifierId);

      if (identifierIndex === -1) {
        throw new Error('Identifiant introuvable.');
      }

      const currentIdentifier = nextInventory[identifierIndex];
      updatedIdentifier = {
        ...currentIdentifier,
        status: 'available',
        employeeId: undefined,
      };

      nextInventory[identifierIndex] = updatedIdentifier;
      return nextInventory;
    });

    if (!updatedIdentifier) {
      throw new Error('Impossible de liberer cet identifiant.');
    }

    return updatedIdentifier;
  }, []);

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
      isLoadingCatalog,
      isPurchasing,
      purchaseProduct,
      configureDevice,
      assignIdentifierToEmployee,
      releaseIdentifier,
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
      isLoadingCatalog,
      isPurchasing,
      purchaseProduct,
      configureDevice,
      assignIdentifierToEmployee,
      releaseIdentifier,
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
