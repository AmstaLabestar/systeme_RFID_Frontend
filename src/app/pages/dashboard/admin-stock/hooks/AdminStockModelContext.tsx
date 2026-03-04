import { createContext, useContext, type PropsWithChildren } from 'react';
import { useAdminStockPageModel, type AdminStockPageModel } from './useAdminStockPageModel';

const AdminStockModelContext = createContext<AdminStockPageModel | null>(null);

export function AdminStockModelProvider({ children }: PropsWithChildren) {
  const model = useAdminStockPageModel();
  return <AdminStockModelContext.Provider value={model}>{children}</AdminStockModelContext.Provider>;
}

export function useAdminStockModel() {
  const model = useContext(AdminStockModelContext);
  if (!model) {
    throw new Error('useAdminStockModel must be used within AdminStockModelProvider');
  }
  return model;
}
