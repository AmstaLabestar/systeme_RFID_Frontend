import type {
  IdentifierType,
  MarketplaceProduct,
  MarketplaceStatePayload,
  ModuleKey,
  ServicesStatePayload,
} from './system-state.types';

export const DEFAULT_DEVICE_STOCK = 100;
export const QR_FEEDBACK_COOLDOWN_MS = 2 * 60 * 1000;
export const QR_FEEDBACK_COMMENT_MAX_LENGTH = 280;

export const MODULE_LABELS: Record<ModuleKey, string> = {
  'rfid-presence': 'RFID Presence',
  'rfid-porte': 'RFID Porte',
  biometrie: 'Biometrie',
  feedback: 'Feedback',
};

export const MODULE_ACTION_LABELS: Record<ModuleKey, { assign: string; remove: string }> = {
  'rfid-presence': {
    assign: 'Association badge employee',
    remove: 'Retrait badge employee',
  },
  'rfid-porte': {
    assign: 'Association identifiant porte',
    remove: 'Retrait identifiant porte',
  },
  biometrie: {
    assign: 'Association empreinte employee',
    remove: 'Retrait empreinte employee',
  },
  feedback: {
    assign: 'N/A',
    remove: 'N/A',
  },
};

export const IDENTIFIER_PREFIXES: Record<IdentifierType, string> = {
  'badge-rfid': 'BAD',
  empreinte: 'EMP',
  'serrure-rfid': 'SER',
};

export const IDENTIFIER_COUNTER_SEED: Record<IdentifierType, number> = {
  'badge-rfid': 1000,
  empreinte: 3000,
  'serrure-rfid': 2000,
};

export const DEVICE_COUNTER_SEED: Record<ModuleKey, number> = {
  'rfid-presence': 0,
  'rfid-porte': 0,
  biometrie: 0,
  feedback: 0,
};

export const MODULE_MAC_SEGMENT: Record<ModuleKey, number> = {
  'rfid-presence': 0x31,
  'rfid-porte': 0x32,
  biometrie: 0x33,
  feedback: 0x34,
};

export const MARKETPLACE_CATALOG: MarketplaceProduct[] = [
  {
    id: 'device-rfid-presence',
    apiSku: 'HW-RFP-001',
    kind: 'device',
    module: 'rfid-presence',
    identifierType: 'badge-rfid',
    label: 'Boitier RFID Presence',
    description: 'Unite centrale de gestion de presence et badges RFID.',
    unitPrice: 21000,
    stockLimit: DEFAULT_DEVICE_STOCK,
    includedIdentifiers: 5,
  },
  {
    id: 'device-rfid-porte',
    apiSku: 'HW-RFD-001',
    kind: 'device',
    module: 'rfid-porte',
    identifierType: 'serrure-rfid',
    label: 'Boitier RFID Porte',
    description: 'Unite centrale de controle d acces des portes.',
    unitPrice: 20000,
    stockLimit: DEFAULT_DEVICE_STOCK,
    includedIdentifiers: 5,
  },
  {
    id: 'device-biometrie',
    apiSku: 'HW-BIO-001',
    kind: 'device',
    module: 'biometrie',
    identifierType: 'empreinte',
    label: 'Boitier Empreinte Digitale',
    description: 'Unite centrale de reconnaissance biometrique.',
    unitPrice: 20000,
    stockLimit: DEFAULT_DEVICE_STOCK,
    includedIdentifiers: 5,
  },
  {
    id: 'device-feedback',
    apiSku: 'HW-FBK-001',
    kind: 'device',
    module: 'feedback',
    label: 'Boitier Feedback',
    description: 'Boitier a 3 boutons (negatif, neutre, positif) pour la satisfaction.',
    unitPrice: 15000,
    stockLimit: DEFAULT_DEVICE_STOCK,
    includedIdentifiers: 0,
  },
  {
    id: 'pack-badge-rfid',
    apiSku: 'PK-BAD-010',
    kind: 'identifier-pack',
    module: 'rfid-presence',
    identifierType: 'badge-rfid',
    label: 'Pack Badges RFID',
    description: '10 badges RFID supplementaires pour vos boitiers presence.',
    unitPrice: 1000,
    quantityPerPack: 10,
  },
  {
    id: 'pack-empreinte',
    apiSku: 'PK-BIO-010',
    kind: 'identifier-pack',
    module: 'biometrie',
    identifierType: 'empreinte',
    label: 'Pack Emprunts (Empreinte)',
    description: '10 identifiants biometrie supplementaires.',
    unitPrice: 1000,
    quantityPerPack: 10,
  },
  {
    id: 'pack-serrure-rfid',
    apiSku: 'PK-SER-010',
    kind: 'identifier-pack',
    module: 'rfid-porte',
    identifierType: 'serrure-rfid',
    label: 'Pack Serrures RFID',
    description: '10 identifiants de serrure supplementaires pour RFID Porte.',
    unitPrice: 1000,
    quantityPerPack: 10,
  },
];

export const CATALOG_BY_ID = new Map(MARKETPLACE_CATALOG.map((product) => [product.id, product]));

export function createDefaultMarketplaceState(): MarketplaceStatePayload {
  const productStockById = MARKETPLACE_CATALOG.reduce<Record<string, number | null>>(
    (accumulator, product) => {
      accumulator[product.id] = typeof product.stockLimit === 'number' ? product.stockLimit : null;
      return accumulator;
    },
    {},
  );

  return {
    productStockById,
    devices: [],
    inventory: [],
  };
}

export function createDefaultServicesState(): ServicesStatePayload {
  return {
    employees: [],
    assignments: [],
    history: [],
    feedbackRecords: [],
  };
}
