import {
  CreditCard,
  DoorOpen,
  Fingerprint,
  LayoutDashboard,
  MessageSquare,
  Settings as SettingsIcon,
  ShoppingBag,
} from 'lucide-react';
import type { ReactElement } from 'react';
import type { SidebarItem } from '@/app/layout';
import { Dashboard, FeedbackView, Fingerprint as FingerprintSystem, Marketplace, RFIDBadge, RFIDDoor, Settings } from '@/app/modules';
import type { Device, PageId } from '@/app/shared/types';

type PurchaseHandler = (items: unknown[]) => void;

interface ModuleRenderContext {
  devices: Device[];
  navigate: (page: PageId) => void;
  onPurchase: PurchaseHandler;
}

interface AppModule extends SidebarItem {
  render: (context: ModuleRenderContext) => ReactElement;
}

export const defaultPageId: PageId = 'dashboard';

export const appModules: AppModule[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    render: ({ devices, navigate }) => <Dashboard devices={devices} onNavigate={navigate} />,
  },
  {
    id: 'rfid-badge',
    label: 'RFID Badge / Presence',
    icon: CreditCard,
    render: ({ devices }) => <RFIDBadge devices={devices} />,
  },
  {
    id: 'rfid-door',
    label: 'RFID Porte',
    icon: DoorOpen,
    render: ({ devices }) => <RFIDDoor devices={devices} />,
  },
  {
    id: 'fingerprint',
    label: 'Empreinte Digitale',
    icon: Fingerprint,
    render: ({ devices }) => <FingerprintSystem devices={devices} />,
  },
  {
    id: 'feedback',
    label: 'Feedback',
    icon: MessageSquare,
    render: ({ devices }) => <FeedbackView devices={devices} />,
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: ShoppingBag,
    render: ({ onPurchase }) => <Marketplace onPurchase={onPurchase} />,
  },
  {
    id: 'settings',
    label: 'Parametres',
    icon: SettingsIcon,
    render: () => <Settings />,
  },
];

export const sidebarItems: SidebarItem[] = appModules.map(({ id, label, icon }) => ({
  id,
  label,
  icon,
}));

export const appModuleById: Record<PageId, AppModule> = appModules.reduce(
  (acc, module) => {
    acc[module.id] = module;
    return acc;
  },
  {} as Record<PageId, AppModule>,
);
