import { useMemo } from 'react';
import { useAdminStockModel } from '../AdminStockModelContext';

export function useAdminStockStockModule() {
  const model = useAdminStockModel();

  return useMemo(
    () => ({
      t: model.t,
      isAdmin: model.isAdmin,
      systems: model.systems,
      lowStockAlertsQuery: model.lowStockAlertsQuery,
      createSystemPayload: model.createSystemPayload,
      setCreateSystemPayload: model.setCreateSystemPayload,
      expectedCreateIdentifierType: model.expectedCreateIdentifierType,
      getIdentifierTypeLabel: model.getIdentifierTypeLabel,
      handleCreateSystem: model.handleCreateSystem,
      pricingDraftsBySystemId: model.pricingDraftsBySystemId,
      pendingPricingSystemId: model.pendingPricingSystemId,
      updateSystemPricingMutation: model.updateSystemPricingMutation,
      handlePricingDraftChange: model.handlePricingDraftChange,
      handleSaveSystemPricing: model.handleSaveSystemPricing,
      inventoryFilters: model.inventoryFilters,
      setInventoryFilters: model.setInventoryFilters,
      inventoryQuery: model.inventoryQuery,
      totalInventoryPages: model.totalInventoryPages,
      setSelectedDeviceId: model.setSelectedDeviceId,
      selectedDeviceId: model.selectedDeviceId,
      deviceDetailQuery: model.deviceDetailQuery,
      selectedDeviceDetail: model.selectedDeviceDetail,
      selectedDeviceMovements: model.selectedDeviceMovements,
      selectedDeviceLogs: model.selectedDeviceLogs,
      selectedDeviceIdentifiers: model.selectedDeviceIdentifiers,
      toggleSystemMutation: model.toggleSystemMutation,
    }),
    [model],
  );
}
