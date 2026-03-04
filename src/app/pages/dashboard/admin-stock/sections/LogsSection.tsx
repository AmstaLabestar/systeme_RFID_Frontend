import { InlineStateMessage } from '../components/AsyncStates';
import { useAdminStockLogsModule } from '../hooks/modules/useAdminStockLogsModule';
import { formatAuditDetails, formatDateTime } from '../shared';

export function LogsSection() {
  const { t, adminLogsQuery } = useAdminStockLogsModule();

  return (
    <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
      <div className="card-body p-5">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('adminStock.logs.title')}</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          {t('adminStock.logs.description')}
        </p>
        <div className="mt-3 space-y-2 text-sm">
          {adminLogsQuery.isLoading ? (
            <InlineStateMessage kind="loading" message={t('adminStock.logs.loading')} />
          ) : adminLogsQuery.isError ? (
            <InlineStateMessage kind="error" message={t('adminStock.logs.error')} />
          ) : (adminLogsQuery.data?.items ?? []).length === 0 ? (
            <InlineStateMessage kind="empty" message={t('adminStock.logs.empty')} />
          ) : (
            (adminLogsQuery.data?.items ?? []).map((log) => (
              <div key={log.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-[var(--text-primary)]">{log.action}</p>
                  <span className="badge badge-outline badge-xs">{log.targetType || 'UNKNOWN'}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {log.actor?.email ?? 'acteur inconnu'} - {formatDateTime(log.createdAt)}
                </p>
                {log.targetId ? (
                  <p className="text-xs text-[var(--text-secondary)]">Ressource: {log.targetId}</p>
                ) : null}
                {formatAuditDetails(log.details) ? (
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                    Details: {formatAuditDetails(log.details)}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
