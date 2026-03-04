import { useMemo } from 'react';
import { useAdminStockModel } from '../AdminStockModelContext';

export function useAdminStockLogsModule() {
  const model = useAdminStockModel();

  return useMemo(
    () => ({
      t: model.t,
      adminLogsQuery: model.adminLogsQuery,
    }),
    [model],
  );
}
