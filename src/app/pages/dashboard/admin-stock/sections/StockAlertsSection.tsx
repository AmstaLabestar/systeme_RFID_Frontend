import { AlertTriangle } from 'lucide-react';
import { useAdminStockStockModule } from '../hooks/modules/useAdminStockStockModule';

export function StockAlertsSection() {
  const { t, lowStockAlertsQuery } = useAdminStockStockModule();

  return (
    <>
      {(lowStockAlertsQuery.data ?? []).map((alert) => (
        <div
          key={`${alert.systemId}-${alert.warehouseCode}`}
          className={`alert ${alert.severity === 'critical' ? 'border-[var(--error-main)]/40 bg-[var(--error-main)]/10' : 'border-[var(--warning-main)]/40 bg-[var(--warning-main)]/10'}`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span>
            {t('adminStock.alert.lowStock', {
              system: alert.systemName,
              warehouse: alert.warehouseCode,
              devices: alert.availableDevices,
              extensions: alert.availableExtensions,
              deviceRestock: alert.recommendedDeviceRestock,
              extensionRestock: alert.recommendedExtensionRestock,
            })}
          </span>
        </div>
      ))}
    </>
  );
}
