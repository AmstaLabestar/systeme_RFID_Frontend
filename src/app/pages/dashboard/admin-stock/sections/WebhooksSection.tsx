import type { OutboxEventType } from '@/app/services';
import { TableStateRow } from '../components/AsyncStates';
import { useAdminStockWebhooksModule } from '../hooks/modules/useAdminStockWebhooksModule';
import { WEBHOOK_EVENT_OPTIONS, formatDateTime } from '../shared';

export function WebhooksSection() {
  const {
    t,
    webhooksQuery,
    webhooks,
    activeWebhooks,
    failingWebhooks,
    webhookForm,
    setWebhookForm,
    canCreateWebhook,
    createWebhookMutation,
    handleCreateWebhook,
    pendingWebhookAction,
    toggleWebhookMutation,
    testWebhookMutation,
  } = useAdminStockWebhooksModule();

  return (
    <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
      <div className="card-body space-y-4 p-5">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('adminStock.webhooks.title')}</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          {t('adminStock.webhooks.description')}
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
            <p className="text-xs text-[var(--text-secondary)]">Endpoints total</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{webhooks.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
            <p className="text-xs text-[var(--text-secondary)]">Actifs</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{activeWebhooks}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
            <p className="text-xs text-[var(--text-secondary)]">En echec</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{failingWebhooks}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <input
            className="input input-bordered bg-[var(--surface-muted)]"
            placeholder="Nom webhook"
            value={webhookForm.name}
            onChange={(event) => setWebhookForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            className="input input-bordered bg-[var(--surface-muted)]"
            placeholder="https://votre-endpoint/webhook"
            value={webhookForm.url}
            onChange={(event) => setWebhookForm((prev) => ({ ...prev, url: event.target.value }))}
          />
          <select
            className="select select-bordered bg-[var(--surface-muted)]"
            value={webhookForm.eventType}
            onChange={(event) =>
              setWebhookForm((prev) => ({
                ...prev,
                eventType: event.target.value as OutboxEventType,
              }))
            }
          >
            {WEBHOOK_EVENT_OPTIONS.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
          <input
            className="input input-bordered bg-[var(--surface-muted)]"
            placeholder="Secret (optionnel)"
            value={webhookForm.secret}
            onChange={(event) => setWebhookForm((prev) => ({ ...prev, secret: event.target.value }))}
          />
        </div>

        <button
          type="button"
          className="btn btn-outline btn-info w-fit"
          disabled={createWebhookMutation.isPending || !canCreateWebhook}
          onClick={handleCreateWebhook}
        >
          {createWebhookMutation.isPending
            ? t('adminStock.webhooks.actions.creating')
            : t('adminStock.webhooks.actions.add')}
        </button>
        {pendingWebhookAction ? (
          <p className="text-xs text-[var(--text-secondary)]">
            {t('adminStock.webhooks.pendingAction')}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Nom</th>
                <th>URL</th>
                <th>Events</th>
                <th>Etat</th>
                <th>Dernier envoi</th>
                <th>Echecs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {webhooksQuery.isLoading ? (
                <TableStateRow colSpan={7} kind="loading" message={t('adminStock.webhooks.loading')} />
              ) : webhooksQuery.isError ? (
                <TableStateRow colSpan={7} kind="error" message={t('adminStock.webhooks.error')} />
              ) : webhooks.length === 0 ? (
                <TableStateRow colSpan={7} kind="empty" message={t('adminStock.webhooks.empty')} />
              ) : (
                webhooks.map((webhook) => {
                  const isTogglePending =
                    toggleWebhookMutation.isPending &&
                    pendingWebhookAction?.type === 'toggle' &&
                    pendingWebhookAction.webhookId === webhook.id;
                  const isTestPending =
                    testWebhookMutation.isPending &&
                    pendingWebhookAction?.type === 'test' &&
                    pendingWebhookAction.webhookId === webhook.id;

                  return (
                    <tr key={webhook.id}>
                      <td>{webhook.name}</td>
                      <td className="max-w-[260px] truncate">{webhook.url}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.map((eventType) => (
                            <span key={`${webhook.id}-${eventType}`} className="badge badge-outline badge-xs">
                              {eventType}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${webhook.isActive ? 'badge-success' : 'badge-warning'}`}>
                          {webhook.isActive
                            ? t('adminStock.webhooks.status.active')
                            : t('adminStock.webhooks.status.inactive')}
                        </span>
                      </td>
                      <td>{webhook.lastDeliveredAt ? formatDateTime(webhook.lastDeliveredAt) : 'Jamais'}</td>
                      <td>{webhook.failureCount}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            disabled={isTogglePending || isTestPending}
                            onClick={() =>
                              toggleWebhookMutation.mutate({
                                webhookId: webhook.id,
                                isActive: !webhook.isActive,
                              })
                            }
                          >
                            {isTogglePending
                              ? t('adminStock.webhooks.actions.toggleUpdating')
                              : webhook.isActive
                                ? t('adminStock.webhooks.actions.disable')
                                : t('adminStock.webhooks.actions.enable')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-info btn-xs"
                            disabled={isTogglePending || isTestPending || webhook.events.length === 0}
                            onClick={() =>
                              testWebhookMutation.mutate({
                                webhookId: webhook.id,
                                eventType: webhook.events[0],
                              })
                            }
                          >
                            {isTestPending
                              ? t('adminStock.webhooks.actions.testing')
                              : t('adminStock.webhooks.actions.test')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
