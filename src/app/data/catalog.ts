import type { DashboardNavItem, IdentifierType, ModuleKey } from '@/app/types';

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

export const BASE_NAV_ITEMS: DashboardNavItem[] = [
  { page: 'overview', label: 'Overview', path: '/dashboard/overview' },
  { page: 'marketplace', label: 'Marketplace', path: '/dashboard/marketplace' },
  {
    page: 'admin-stock',
    label: 'Admin Stock',
    path: '/dashboard/admin-stock',
    roles: ['admin'],
  },
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
