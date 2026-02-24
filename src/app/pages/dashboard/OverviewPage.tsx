import { AlertTriangle, Boxes, CheckCircle2, Clock3, Layers, ShieldAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketplace, useServices } from '@/app/contexts';
import { formatDateTime } from '@/app/services';
import { EmptyState, MetricCard, PageHeader } from '@/app/shared/components';

export function OverviewPage() {
  const navigate = useNavigate();
  const { devices, inventory } = useMarketplace();
  const { history } = useServices();

  const configuredDevices = devices.filter((device) => device.configured);
  const pendingDevices = devices.filter((device) => !device.configured);

  const assignedIdentifiers = inventory.filter((identifier) => identifier.status === 'assigned').length;
  const availableIdentifiers = inventory.length - assignedIdentifiers;
  const activeModules = new Set(configuredDevices.map((device) => device.module)).size;

  const remainingRate = inventory.length > 0 ? (availableIdentifiers / inventory.length) * 100 : 100;

  const recentHistory = useMemo(() => history.slice(0, 8), [history]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Vision globale des capacites, modules actives et risques d exploitation en temps reel."
        actions={
          <>
            <button type="button" className="btn btn-outline btn-info" onClick={() => navigate('/dashboard/historique')}>
              Historique global
            </button>
            <button type="button" className="btn btn-info text-[var(--app-bg)]" onClick={() => navigate('/dashboard/marketplace')}>
              Ajouter des services
            </button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Boitiers actifs"
          value={configuredDevices.length}
          hint={`${devices.length} achetes au total`}
          tone="positive"
          icon={CheckCircle2}
        />
        <MetricCard
          title="Boitiers a activer"
          value={pendingDevices.length}
          hint="Services visibles mais inactifs tant que non lies par MAC"
          tone={pendingDevices.length > 0 ? 'negative' : 'default'}
          icon={ShieldAlert}
        />
        <MetricCard
          title="Identifiants disponibles"
          value={availableIdentifiers}
          hint={`${assignedIdentifiers} deja associes`}
          tone={availableIdentifiers > 0 ? 'positive' : 'negative'}
          icon={Boxes}
        />
        <MetricCard title="Modules actifs" value={activeModules} hint="RFID + biometrie + feedback" icon={Layers} />
      </section>

      {remainingRate < 20 && inventory.length > 0 && (
        <div className="alert border-[var(--warning-main)]/40 bg-[var(--warning-main)]/10 text-[var(--text-primary)]">
          <AlertTriangle className="h-5 w-5 text-[var(--warning-main)]" />
          <span>Capacite identifiants faible ({remainingRate.toFixed(1)}% restant). Augmentez le stock.</span>
          <button type="button" className="btn btn-sm btn-info text-[var(--app-bg)]" onClick={() => navigate('/dashboard/marketplace')}>
            Acheter des packs
          </button>
        </div>
      )}

      {devices.length === 0 ? (
        <EmptyState
          title="Aucun boitier achete"
          description="Le Marketplace est le point d entree unique. Chaque achat provisionne vos entites SaaS."
          action={
            <button type="button" className="btn btn-info text-[var(--app-bg)]" onClick={() => navigate('/dashboard/marketplace')}>
              Demarrer dans le Marketplace
            </button>
          }
        />
      ) : (
        <section className="grid gap-4 xl:grid-cols-3">
          <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)] xl:col-span-2">
            <div className="card-body p-0">
              <div className="px-5 py-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Activite recente</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date / Heure</th>
                      <th>Employee</th>
                      <th>Identifiant</th>
                      <th>Boitier</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-sm text-[var(--text-secondary)]">
                          Aucun evenement recent.
                        </td>
                      </tr>
                    )}
                    {recentHistory.map((event) => (
                      <tr key={event.id}>
                        <td>{formatDateTime(event.occurredAt)}</td>
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
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Boitiers en attente</h2>
              <div className="mt-3 space-y-3">
                {pendingDevices.length === 0 && (
                  <p className="text-sm text-[var(--text-secondary)]">Tous les boitiers sont actives.</p>
                )}
                {pendingDevices.map((device) => (
                  <div key={device.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{device.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">Module: {device.module}</p>
                    <p className="text-xs text-[var(--warning-main)]">Activation MAC requise</p>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-outline btn-info mt-3" onClick={() => navigate('/dashboard/marketplace')}>
                Commander des boitiers
              </button>
            </div>
          </article>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article className="card border border-[var(--success-main)]/40 bg-[var(--success-main)]/10">
          <div className="card-body p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--success-main)]">KPI positif</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{assignedIdentifiers}</p>
            <p className="text-sm text-[var(--text-secondary)]">Associations actives et tracees</p>
          </div>
        </article>

        <article className="card border border-[var(--error-main)]/40 bg-[var(--error-main)]/10">
          <div className="card-body p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--error-main)]">KPI negatif</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{pendingDevices.length}</p>
            <p className="text-sm text-[var(--text-secondary)]">Boitiers encore hors production</p>
          </div>
        </article>

        <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
          <div className="card-body p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-secondary)]">Derniere mise a jour</p>
              <Clock3 className="h-4 w-4 text-[var(--text-secondary)]" />
            </div>
            <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{formatDateTime(new Date().toISOString())}</p>
            <p className="text-sm text-[var(--text-secondary)]">Etat synchronise avec l API backend</p>
          </div>
        </article>
      </section>
    </div>
  );
}
