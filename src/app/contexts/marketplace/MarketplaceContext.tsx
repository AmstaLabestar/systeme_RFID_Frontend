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
  DEVICE_PRODUCTS,
  IDENTIFIER_PRODUCTS,
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
  configureDevice: (deviceId: string, input: DeviceConfigurationInput) => void;
  assignIdentifierToEmployee: (payload: AssignIdentifierPayload) => InventoryIdentifier;
  releaseIdentifier: (identifierId: string) => InventoryIdentifier;
  getDevicesByModule: (module: ModuleKey, configuredOnly?: boolean) => DeviceUnit[];
  getAvailableIdentifiersByModule: (module: ModuleKey) => InventoryIdentifier[];
  getInventoryById: (identifierId: string) => InventoryIdentifier | undefined;
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

function buildDeviceName(module: ModuleKey, index: number): string {
  const moduleLabel = MODULE_LABELS[module];
  return `Boitier ${moduleLabel} #${index}`;
}

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Product[]>(MARKETPLACE_CATALOG);
  const [devices, setDevices] = useState<DeviceUnit[]>([]);
  const [inventory, setInventory] = useState<InventoryIdentifier[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const identifierCounters = useRef<Record<IdentifierType, number>>({ ...identifierCounterSeed });
  const deviceCounters = useRef<Record<ModuleKey, number>>({ ...deviceCounterSeed });

  const { addNotification } = useNotifications();

  useEffect(() => {
    let isMounted = true;

    marketplaceService
      .fetchCatalog()
      .then((response) => {
        if (!isMounted) {
          return;
        }
        setCatalog(response);
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

  const nextIdentifierCode = useCallback((type: IdentifierType): string => {
    identifierCounters.current[type] += 1;
    const prefix = identifierPrefixes[type];
    return `${prefix}-${identifierCounters.current[type]}`;
  }, []);

  const nextDeviceIndex = useCallback((module: ModuleKey): number => {
    deviceCounters.current[module] += 1;
    return deviceCounters.current[module];
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

      setIsPurchasing(true);

      try {
        const createdDevices: DeviceUnit[] = [];
        const createdIdentifiers: InventoryIdentifier[] = [];

        if (product.kind === 'device') {
          for (let index = 0; index < quantity; index += 1) {
            const deviceNumber = nextDeviceIndex(product.module);
            const deviceId = createId('device');
            const createdAt = new Date().toISOString();
            const device: DeviceUnit = {
              id: deviceId,
              module: product.module,
              name: buildDeviceName(product.module, deviceNumber),
              location: 'A configurer',
              configured: false,
              capacity: product.includedIdentifiers ?? 0,
              createdAt,
            };

            createdDevices.push(device);

            if (product.identifierType && (product.includedIdentifiers ?? 0) > 0) {
              for (let codeIndex = 0; codeIndex < (product.includedIdentifiers ?? 0); codeIndex += 1) {
                createdIdentifiers.push({
                  id: createId('idn'),
                  module: product.module,
                  type: product.identifierType,
                  code: nextIdentifierCode(product.identifierType),
                  status: 'available',
                  deviceId: device.id,
                  acquiredAt: createdAt,
                });
              }
            }
          }
        }

        if (product.kind === 'identifier-pack' && product.identifierType && product.quantityPerPack) {
          const count = quantity * product.quantityPerPack;
          for (let index = 0; index < count; index += 1) {
            createdIdentifiers.push({
              id: createId('idn'),
              module: product.module,
              type: product.identifierType,
              code: nextIdentifierCode(product.identifierType),
              status: 'available',
              acquiredAt: new Date().toISOString(),
            });
          }
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
          createdIdentifiers.length > 0
            ? `${createdIdentifiers.length} ${identifierLabel} crees: ${identifiersPreview}${previewSuffix}`
            : 'Aucun identifiant a provisionner pour ce module.',
        ];

        addNotification({
          title: 'Achat confirme',
          message: messageParts.join(' | '),
          kind: 'success',
          module: product.module,
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
    [catalog, nextDeviceIndex, nextIdentifierCode, addNotification],
  );

  const configureDevice = useCallback(
    (deviceId: string, input: DeviceConfigurationInput) => {
      let updatedDevice: DeviceUnit | undefined;

      setDevices((currentDevices) =>
        currentDevices.map((device) => {
          if (device.id !== deviceId) {
            return device;
          }

          updatedDevice = {
            ...device,
            configured: true,
            name: input.name,
            location: input.location,
          };

          return updatedDevice;
        }),
      );

      if (!updatedDevice) {
        throw new Error('Boitier introuvable.');
      }

      addNotification({
        title: 'Boitier configure',
        message: `${updatedDevice.name} est maintenant actif dans le dashboard.`,
        kind: 'success',
        module: updatedDevice.module,
        withToast: true,
      });
    },
    [addNotification],
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

  const isModuleEnabled = useCallback(
    (module: ModuleKey): boolean => devices.some((device) => device.module === module && device.configured),
    [devices],
  );

  const value = useMemo(
    () => ({
      catalog,
      deviceProducts: DEVICE_PRODUCTS,
      identifierProducts: IDENTIFIER_PRODUCTS,
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
      isModuleEnabled,
    }),
    [
      catalog,
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
