import type { DashboardNavItem, IdentifierType, ModuleKey, Product } from '@/app/types';

export const MODULE_LABELS: Record<ModuleKey, string> = {
  'rfid-presence': 'RFID Presence',
  'rfid-porte': 'RFID Porte',
  biometrie: 'Biometrie',
  feedback: 'Feedback',
};

export const MODULE_PATHS: Record<ModuleKey, string> = {
  'rfid-presence': '/dashboard/rfid-presence',
  'rfid-porte': '/dashboard/rfid-porte',
  biometrie: '/dashboard/biometrie',
  feedback: '/dashboard/feedback',
};

export const IDENTIFIER_LABELS: Record<IdentifierType, string> = {
  'badge-rfid': 'Badge RFID',
  empreinte: 'Empreinte',
  'serrure-rfid': 'Serrure RFID',
};

export const DEVICE_PRODUCTS: Product[] = [
  {
    id: 'device-rfid-presence',
    kind: 'device',
    module: 'rfid-presence',
    identifierType: 'badge-rfid',
    label: 'Boitier RFID Presence',
    description: 'Unite centrale de gestion de presence et badges RFID.',
    unitPrice: 21000,
    includedIdentifiers: 5,
  },
  {
    id: 'device-rfid-porte',
    kind: 'device',
    module: 'rfid-porte',
    identifierType: 'serrure-rfid',
    label: 'Boitier RFID Porte',
    description: 'Unite centrale de controle d acces des portes.',
    unitPrice: 20000,
    includedIdentifiers: 5,
  },
  {
    id: 'device-biometrie',
    kind: 'device',
    module: 'biometrie',
    identifierType: 'empreinte',
    label: 'Boitier Empreinte Digitale',
    description: 'Unite centrale de reconnaissance biometrique.',
    unitPrice: 20000,
    includedIdentifiers: 5,
  },
  {
    id: 'device-feedback',
    kind: 'device',
    module: 'feedback',
    label: 'Boitier Feedback',
    description: 'Boitier a 3 boutons (negatif, neutre, positif) pour la satisfaction.',
    unitPrice: 15000,
    includedIdentifiers: 0,
  },
];

export const IDENTIFIER_PRODUCTS: Product[] = [
  {
    id: 'pack-badge-rfid',
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
    kind: 'identifier-pack',
    module: 'rfid-porte',
    identifierType: 'serrure-rfid',
    label: 'Pack Serrures RFID',
    description: '10 identifiants de serrure supplementaires pour RFID Porte.',
    unitPrice: 1000,
    quantityPerPack: 10,
  },
];

export const MARKETPLACE_CATALOG: Product[] = [...DEVICE_PRODUCTS, ...IDENTIFIER_PRODUCTS];

export const BASE_NAV_ITEMS: DashboardNavItem[] = [
  { page: 'overview', label: 'Overview', path: '/dashboard/overview' },
  { page: 'marketplace', label: 'Marketplace', path: '/dashboard/marketplace' },
  {
    page: 'rfid-presence',
    label: 'RFID Presence',
    path: '/dashboard/rfid-presence',
    module: 'rfid-presence',
  },
  {
    page: 'rfid-porte',
    label: 'RFID Porte',
    path: '/dashboard/rfid-porte',
    module: 'rfid-porte',
  },
  {
    page: 'biometrie',
    label: 'Biometrie',
    path: '/dashboard/biometrie',
    module: 'biometrie',
  },
  { page: 'feedback', label: 'Feedback', path: '/dashboard/feedback', module: 'feedback' },
  { page: 'historique', label: 'Historique', path: '/dashboard/historique' },
];
