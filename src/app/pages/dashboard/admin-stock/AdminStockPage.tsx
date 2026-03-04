import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { EmptyState, PageHeader } from '@/app/shared/components';
import { AdminStockModelProvider, useAdminStockModel } from './hooks/AdminStockModelContext';
import {
  AdminStockAllView,
  AdminStockImportsView,
  AdminStockLogsView,
  AdminStockStockView,
  AdminStockWebhooksView,
} from './AdminStockViews';

function AdminStockNavigation() {
  const baseClass = 'btn btn-sm';
  const basePath = '/dashboard/admin-stock';

  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-3">
      <NavLink
        end
        to={basePath}
        className={({ isActive }) =>
          `${baseClass} ${isActive ? 'btn-info text-[var(--app-bg)]' : 'btn-ghost'}`
        }
      >
        Vue complete
      </NavLink>
      <NavLink
        to={`${basePath}/stock`}
        className={({ isActive }) =>
          `${baseClass} ${isActive ? 'btn-info text-[var(--app-bg)]' : 'btn-ghost'}`
        }
      >
        Stock
      </NavLink>
      <NavLink
        to={`${basePath}/imports`}
        className={({ isActive }) =>
          `${baseClass} ${isActive ? 'btn-info text-[var(--app-bg)]' : 'btn-ghost'}`
        }
      >
        Imports
      </NavLink>
      <NavLink
        to={`${basePath}/webhooks`}
        className={({ isActive }) =>
          `${baseClass} ${isActive ? 'btn-info text-[var(--app-bg)]' : 'btn-ghost'}`
        }
      >
        Webhooks
      </NavLink>
      <NavLink
        to={`${basePath}/logs`}
        className={({ isActive }) =>
          `${baseClass} ${isActive ? 'btn-info text-[var(--app-bg)]' : 'btn-ghost'}`
        }
      >
        Logs
      </NavLink>
    </div>
  );
}

function AdminStockContent() {
  const { t, canManageStock } = useAdminStockModel();

  if (!canManageStock) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('adminStock.title')}
          description={t('adminStock.restricted.description')}
        />
        <EmptyState
          title={t('adminStock.restricted.title')}
          description={t('adminStock.restricted.emptyDescription')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('adminStock.title')}
        description={t('adminStock.description')}
      />
      <AdminStockNavigation />
      <Routes>
        <Route index element={<AdminStockAllView />} />
        <Route path="stock" element={<AdminStockStockView />} />
        <Route path="imports" element={<AdminStockImportsView />} />
        <Route path="webhooks" element={<AdminStockWebhooksView />} />
        <Route path="logs" element={<AdminStockLogsView />} />
        <Route path="*" element={<Navigate to="/dashboard/admin-stock" replace />} />
      </Routes>
    </div>
  );
}

export function AdminStockPage() {
  return (
    <AdminStockModelProvider>
      <AdminStockContent />
    </AdminStockModelProvider>
  );
}
