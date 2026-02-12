import { useState } from 'react';
import { appModuleById, defaultPageId, sidebarItems } from './core';
import { AppLayout } from './layout';
import { defaultNotifications, mockDevices } from './shared/data';
import type { Device, PageId } from './shared/types';

export default function App() {
  const [activePage, setActivePage] = useState<PageId>(defaultPageId);
  const [devices] = useState<Device[]>(mockDevices);

  const handlePurchase = (items: unknown[]) => {
    console.log('Purchased:', items);
  };

  const activeModule = appModuleById[activePage] ?? appModuleById[defaultPageId];

  return (
    <AppLayout
      activePage={activePage}
      onPageChange={setActivePage}
      menuItems={sidebarItems}
      companyName="TechCorp Solutions"
      notifications={defaultNotifications}
    >
      {activeModule.render({
        devices,
        navigate: setActivePage,
        onPurchase: handlePurchase,
      })}
    </AppLayout>
  );
}
