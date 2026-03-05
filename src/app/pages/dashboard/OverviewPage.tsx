import { AlertTriangle, Boxes, CheckCircle2, Clock3, Layers, ShieldAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n, useMarketplace, useServices } from '@/app/contexts';
import { formatDateTime } from '@/app/services';
import { EmptyState, MetricCard, PageHeader } from '@/app/shared/components';

export function OverviewPage() {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const { devices, inventory } = useMarketplace();
  const { history } = useServices();

  const configuredDevices = devices.filter((device) => device.configured);
  const pendingDevices = devices.filter((device) => !device.configured);

  const assignedIdentifiers = inventory.filter((identifier) => identifier.status === 'assigned').length;
  const availableIdentifiers = inventory.filter((identifier) => identifier.status === 'available').length;
  const activeModules = new Set(configuredDevices.map((device) => device.module)).size;

  const remainingRate = inventory.length > 0 ? (availableIdentifiers / inventory.length) * 100 : 100;

  const recentHistory = useMemo(() => history.slice(0, 8), [history]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('overview.title')}
        description={t('overview.description')}
        actions={
          <>
            <button
              type="button"
              className="btn btn-outline btn-info"
              onClick={() => navigate('/dashboard/historique')}
            >
              {t('overview.actions.globalHistory')}
            </button>
            <button
              type="button"
              className="btn btn-info text-[var(--app-bg)]"
              onClick={() => navigate('/dashboard/marketplace')}
            >
              {t('overview.actions.addServices')}
            </button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={t('overview.metrics.activeDevices.title')}
          value={configuredDevices.length}
          hint={t('overview.metrics.activeDevices.hint', { count: devices.length })}
          tone="positive"
          icon={CheckCircle2}
        />
        <MetricCard
          title={t('overview.metrics.pendingDevices.title')}
          value={pendingDevices.length}
          hint={t('overview.metrics.pendingDevices.hint')}
          tone={pendingDevices.length > 0 ? 'negative' : 'default'}
          icon={ShieldAlert}
        />
        <MetricCard
          title={t('overview.metrics.availableIdentifiers.title')}
          value={availableIdentifiers}
          hint={t('overview.metrics.availableIdentifiers.hint', { count: assignedIdentifiers })}
          tone={availableIdentifiers > 0 ? 'positive' : 'negative'}
          icon={Boxes}
        />
        <MetricCard
          title={t('overview.metrics.activeModules.title')}
          value={activeModules}
          hint={t('overview.metrics.activeModules.hint')}
          icon={Layers}
        />
      </section>

      {remainingRate < 20 && inventory.length > 0 && (
        <div className="alert border-[var(--warning-main)]/40 bg-[var(--warning-main)]/10 text-[var(--text-primary)]">
          <AlertTriangle className="h-5 w-5 text-[var(--warning-main)]" />
          <span>{t('overview.lowCapacity', { remainingRate: remainingRate.toFixed(1) })}</span>
          <button
            type="button"
            className="btn btn-sm btn-info text-[var(--app-bg)]"
            onClick={() => navigate('/dashboard/marketplace')}
          >
            {t('overview.buyPacks')}
          </button>
        </div>
      )}

      {devices.length === 0 ? (
        <EmptyState
          title={t('overview.empty.title')}
          description={t('overview.empty.description')}
          action={
            <button
              type="button"
              className="btn btn-info text-[var(--app-bg)]"
              onClick={() => navigate('/dashboard/marketplace')}
            >
              {t('overview.empty.action')}
            </button>
          }
        />
      ) : (
        <section className="grid gap-4 xl:grid-cols-3">
          <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)] xl:col-span-2">
            <div className="card-body p-0">
              <div className="px-5 py-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  {t('overview.recentActivity.title')}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('table.dateTime')}</th>
                      <th>{t('table.employee')}</th>
                      <th>{t('table.identifier')}</th>
                      <th>{t('table.device')}</th>
                      <th>{t('table.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-sm text-[var(--text-secondary)]">
                          {t('overview.recentActivity.none')}
                        </td>
                      </tr>
                    )}
                    {recentHistory.map((event) => (
                      <tr key={event.id}>
                        <td>{formatDateTime(event.occurredAt, locale === 'fr' ? 'fr-FR' : 'en-US')}</td>
                        <td>{event.employee}</td>
                        <td className="font-mono text-[var(--accent-primary)]">{event.identifier}</td>
                        <td>{event.device}</td>
                        <td>{event.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </article>

          <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
            <div className="card-body p-5">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {t('overview.pendingDevicesCard.title')}
              </h2>
              <div className="mt-3 space-y-3">
                {pendingDevices.length === 0 && (
                  <p className="text-sm text-[var(--text-secondary)]">
                    {t('overview.pendingDevicesCard.none')}
                  </p>
                )}
                {pendingDevices.map((device) => (
                  <div
                    key={device.id}
                    className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3"
                  >
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{device.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {t('overview.pendingDevicesCard.module', { module: device.module })}
                    </p>
                    <p className="text-xs text-[var(--warning-main)]">
                      {t('overview.pendingDevicesCard.macRequired')}
                    </p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-outline btn-info mt-3"
                onClick={() => navigate('/dashboard/marketplace')}
              >
                {t('overview.pendingDevicesCard.orderDevices')}
              </button>
            </div>
          </article>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article className="card border border-[var(--success-main)]/40 bg-[var(--success-main)]/10">
          <div className="card-body p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--success-main)]">
              {t('overview.kpiPositive.title')}
            </p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{assignedIdentifiers}</p>
            <p className="text-sm text-[var(--text-secondary)]">{t('overview.kpiPositive.hint')}</p>
          </div>
        </article>

        <article className="card border border-[var(--error-main)]/40 bg-[var(--error-main)]/10">
          <div className="card-body p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--error-main)]">
              {t('overview.kpiNegative.title')}
            </p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{pendingDevices.length}</p>
            <p className="text-sm text-[var(--text-secondary)]">{t('overview.kpiNegative.hint')}</p>
          </div>
        </article>

        <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
          <div className="card-body p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-secondary)]">{t('overview.lastUpdate.title')}</p>
              <Clock3 className="h-4 w-4 text-[var(--text-secondary)]" />
            </div>
            <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
              {formatDateTime(new Date().toISOString(), locale === 'fr' ? 'fr-FR' : 'en-US')}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">{t('overview.lastUpdate.hint')}</p>
          </div>
        </article>
      </section>
    </div>
  );
}
