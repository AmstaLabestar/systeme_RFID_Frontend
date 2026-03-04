import { Search } from 'lucide-react';
import { type HardwareSystemCode } from '@/app/services';
import { TableStateRow } from '../components/AsyncStates';
import { useAdminStockStockModule } from '../hooks/modules/useAdminStockStockModule';
import {
  DEFAULT_SYSTEM_PRICING,
  SYSTEM_CODE_OPTIONS,
  SYSTEM_IDENTIFIER_TYPE_MAP,
  formatAuditDetails,
  formatDateTime,
  formatMoneyFromCents,
} from '../shared';

export function StockSection() {
  const {
    t,
    isAdmin,
    systems,
    createSystemPayload,
    setCreateSystemPayload,
    expectedCreateIdentifierType,
    getIdentifierTypeLabel,
    handleCreateSystem,
    pricingDraftsBySystemId,
    pendingPricingSystemId,
    updateSystemPricingMutation,
    handlePricingDraftChange,
    handleSaveSystemPricing,
    inventoryFilters,
    setInventoryFilters,
    inventoryQuery,
    totalInventoryPages,
    setSelectedDeviceId,
    selectedDeviceId,
    deviceDetailQuery,
    selectedDeviceDetail,
    selectedDeviceMovements,
    selectedDeviceLogs,
    selectedDeviceIdentifiers,
    toggleSystemMutation,
  } = useAdminStockStockModule();

  return (
    <>
      <section className="space-y-6">
        {isAdmin ? (
          <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
            <div className="card-body space-y-3 p-5">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {t('adminStock.newSystem.title')}
              </h3>
              <input
                className="input input-bordered bg-[var(--surface-muted)]"
                value={createSystemPayload.name}
                onChange={(event) => setCreateSystemPayload((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nom"
              />
              <select
                className="select select-bordered bg-[var(--surface-muted)]"
                value={createSystemPayload.code}
                onChange={(event) =>
                  setCreateSystemPayload((prev) => {
                    const nextCode = event.target.value as HardwareSystemCode;
                    const isFeedbackSystem = nextCode === 'FEEDBACK';
                    const defaultPricing = DEFAULT_SYSTEM_PRICING[nextCode];
                    const forcedIdentifierType = isFeedbackSystem
                      ? prev.identifierType
                      : SYSTEM_IDENTIFIER_TYPE_MAP[nextCode as Exclude<HardwareSystemCode, 'FEEDBACK'>];
                    return {
                      ...prev,
                      code: nextCode,
                      hasIdentifiers: !isFeedbackSystem,
                      identifierType: forcedIdentifierType,
                      deviceUnitPriceCents: defaultPricing.deviceUnitPriceCents,
                      extensionUnitPriceCents: defaultPricing.extensionUnitPriceCents,
                      currency: defaultPricing.currency,
                    };
                  })
                }
              >
                {SYSTEM_CODE_OPTIONS.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <select
                className="select select-bordered bg-[var(--surface-muted)]"
                value={createSystemPayload.identifierType}
                onChange={() => undefined}
                disabled
              >
                {expectedCreateIdentifierType ? (
                  <option value={expectedCreateIdentifierType}>
                    {expectedCreateIdentifierType} ({getIdentifierTypeLabel(expectedCreateIdentifierType)})
                  </option>
                ) : (
                  <option value={createSystemPayload.identifierType}>Aucun</option>
                )}
              </select>
              <p className="text-xs text-[var(--text-secondary)]">
                Mapping impose: RFID Presence = BADGE, RFID Porte = SERRURE, Biometrie = EMPREINTE.
              </p>
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type="checkbox"
                  className="toggle toggle-info"
                  checked={createSystemPayload.code !== 'FEEDBACK'}
                  onChange={() => undefined}
                  disabled
                />
                <span className="label-text">
                  {createSystemPayload.code === 'FEEDBACK'
                    ? 'Sans identifiants (impose pour FEEDBACK)'
                    : 'Avec identifiants (impose par le type de systeme)'}
                </span>
              </label>
              <div className="grid gap-2 md:grid-cols-3">
                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">Prix boitier</span>
                  <input
                    type="number"
                    min={0}
                    className="input input-bordered bg-[var(--surface-muted)]"
                    value={createSystemPayload.deviceUnitPriceCents}
                    onChange={(event) =>
                      setCreateSystemPayload((prev) => ({
                        ...prev,
                        deviceUnitPriceCents: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">
                    Prix extension
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="input input-bordered bg-[var(--surface-muted)]"
                    value={
                      createSystemPayload.code === 'FEEDBACK'
                        ? 0
                        : createSystemPayload.extensionUnitPriceCents
                    }
                    disabled={createSystemPayload.code === 'FEEDBACK'}
                    onChange={(event) =>
                      setCreateSystemPayload((prev) => ({
                        ...prev,
                        extensionUnitPriceCents: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">Devise</span>
                  <input
                    className="input input-bordered bg-[var(--surface-muted)]"
                    value={createSystemPayload.currency}
                    maxLength={3}
                    onChange={(event) =>
                      setCreateSystemPayload((prev) => ({
                        ...prev,
                        currency: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="XOF"
                  />
                </label>
              </div>
              <button type="button" className="btn btn-info text-[var(--app-bg)]" onClick={handleCreateSystem}>
                {t('adminStock.actions.createSystem')}
              </button>
            </div>
          </article>
        ) : null}
      </section>

      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body space-y-4 p-5">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('adminStock.pricing.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('adminStock.pricing.description')}
          </p>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Systeme</th>
                  <th>Prix boitier</th>
                  <th>Prix extension</th>
                  <th>Devise</th>
                  <th>Apercu</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {systems.map((system) => {
                  const draft = pricingDraftsBySystemId[system.id] ?? {
                    deviceUnitPriceCents: String(system.deviceUnitPriceCents),
                    extensionUnitPriceCents: String(system.extensionUnitPriceCents),
                    currency: system.currency,
                  };
                  const previewDeviceCents = Number.parseInt(draft.deviceUnitPriceCents, 10);
                  const previewExtensionCents = Number.parseInt(draft.extensionUnitPriceCents, 10);
                  const previewCurrency = draft.currency.trim().toUpperCase() || 'XOF';
                  const isPricingPending =
                    updateSystemPricingMutation.isPending && pendingPricingSystemId === system.id;

                  return (
                    <tr key={`pricing-${system.id}`}>
                      <td>
                        <p className="font-medium text-[var(--text-primary)]">{system.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{system.code}</p>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className="input input-bordered input-sm w-36 bg-[var(--surface-muted)]"
                          value={draft.deviceUnitPriceCents}
                          onChange={(event) =>
                            handlePricingDraftChange(
                              system.id,
                              'deviceUnitPriceCents',
                              event.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className="input input-bordered input-sm w-36 bg-[var(--surface-muted)]"
                          value={system.code === 'FEEDBACK' ? '0' : draft.extensionUnitPriceCents}
                          disabled={system.code === 'FEEDBACK'}
                          onChange={(event) =>
                            handlePricingDraftChange(
                              system.id,
                              'extensionUnitPriceCents',
                              event.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input input-bordered input-sm w-20 bg-[var(--surface-muted)]"
                          value={draft.currency}
                          maxLength={3}
                          onChange={(event) =>
                            handlePricingDraftChange(system.id, 'currency', event.target.value)
                          }
                        />
                      </td>
                      <td className="text-xs text-[var(--text-secondary)]">
                        {formatMoneyFromCents(
                          Number.isFinite(previewDeviceCents) ? previewDeviceCents : 0,
                          previewCurrency,
                        )}
                        {system.code !== 'FEEDBACK'
                          ? ` / ${formatMoneyFromCents(
                              Number.isFinite(previewExtensionCents) ? previewExtensionCents : 0,
                              previewCurrency,
                            )}`
                          : ''}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline btn-info btn-sm"
                          disabled={isPricingPending}
                          onClick={() => handleSaveSystemPricing(system.id)}
                        >
                          {isPricingPending ? t('adminStock.actions.saving') : t('adminStock.actions.save')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body space-y-3 p-5">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('adminStock.inventory.title')}</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('adminStock.inventory.description')}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <select
              className="select select-bordered bg-[var(--surface-muted)]"
              value={inventoryFilters.systemId ?? ''}
              onChange={(event) =>
                setInventoryFilters((prev) => ({
                  ...prev,
                  page: 1,
                  systemId: event.target.value || undefined,
                }))
              }
            >
              <option value="">Tous systemes</option>
              {systems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </select>
            <select
              className="select select-bordered bg-[var(--surface-muted)]"
              value={inventoryFilters.status ?? ''}
              onChange={(event) =>
                setInventoryFilters((prev) => ({
                  ...prev,
                  page: 1,
                  status: (event.target.value || undefined) as typeof prev.status,
                }))
              }
            >
              <option value="">Tous statuts</option>
              <option value="IN_STOCK">IN_STOCK</option>
              <option value="RESERVED">RESERVED</option>
              <option value="ASSIGNED">ASSIGNED</option>
            </select>
            <div className="relative grow">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-secondary)]" />
              <input
                className="input input-bordered w-full bg-[var(--surface-muted)] pl-9"
                value={inventoryFilters.search ?? ''}
                onChange={(event) =>
                  setInventoryFilters((prev) => ({
                    ...prev,
                    page: 1,
                    search: event.target.value,
                  }))
                }
                placeholder="Recherche MAC / identifiant"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>MAC</th>
                  <th>Systeme</th>
                  <th>Statut</th>
                  <th>Entrepot</th>
                  <th>Proprietaire</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {inventoryQuery.isLoading ? (
                  <TableStateRow colSpan={6} kind="loading" message={t('adminStock.inventory.loading')} />
                ) : inventoryQuery.isError ? (
                  <TableStateRow colSpan={6} kind="error" message={t('adminStock.inventory.error')} />
                ) : (inventoryQuery.data?.items ?? []).length === 0 ? (
                  <TableStateRow colSpan={6} kind="empty" message={t('adminStock.inventory.empty')} />
                ) : (
                  inventoryQuery.data?.items.map((device) => (
                    <tr key={device.id}>
                      <td className="font-mono text-xs">{device.macAddress}</td>
                      <td>{device.system.name}</td>
                      <td>
                        <span className="badge badge-outline">{device.status}</span>
                      </td>
                      <td>{device.warehouseCode}</td>
                      <td>{device.ownerEmail ?? '-'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => setSelectedDeviceId(device.id)}
                        >
                          {t('adminStock.inventory.detail')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-[var(--text-secondary)]">
              {(inventoryQuery.data?.total ?? 0).toLocaleString()} boitier(s) au total
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-outline btn-xs"
                disabled={(inventoryFilters.page ?? 1) <= 1}
                onClick={() =>
                  setInventoryFilters((prev) => ({
                    ...prev,
                    page: Math.max(1, (prev.page ?? 1) - 1),
                  }))
                }
              >
                {t('adminStock.pagination.previous')}
              </button>
              <span className="text-[var(--text-secondary)]">
                Page {inventoryFilters.page ?? 1} / {totalInventoryPages}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                disabled={(inventoryFilters.page ?? 1) >= totalInventoryPages}
                onClick={() =>
                  setInventoryFilters((prev) => ({
                    ...prev,
                    page: Math.min(totalInventoryPages, (prev.page ?? 1) + 1),
                  }))
                }
              >
                {t('adminStock.pagination.next')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {systems.map((system) => (
          <article key={system.id} className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
            <div className="card-body p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">{system.code}</p>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{system.name}</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {system.code === 'FEEDBACK'
                  ? `Stock: ${system.availableDevices} boitiers (sans extensions)`
                  : `Stock: ${system.availableDevices} boitiers, ${system.availableExtensions} extensions`}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Prix: {formatMoneyFromCents(system.deviceUnitPriceCents, system.currency)}
                {system.code !== 'FEEDBACK'
                  ? ` / ${formatMoneyFromCents(system.extensionUnitPriceCents, system.currency)}`
                  : ''}
              </p>
              <button
                type="button"
                className="btn btn-outline btn-sm mt-2"
                onClick={() =>
                  toggleSystemMutation.mutate({
                    systemId: system.id,
                    isActive: !system.isActive,
                  })
                }
              >
                {system.isActive ? 'Desactiver' : 'Activer'}
              </button>
            </div>
          </article>
        ))}
      </section>

      {selectedDeviceId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card max-h-[80vh] w-full max-w-3xl overflow-y-auto border border-[var(--border-soft)] bg-[var(--card-bg)]">
            <div className="card-body space-y-3 p-5">
              <div className="flex justify-end">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedDeviceId(null)}>
                  {t('adminStock.deviceModal.close')}
                </button>
              </div>
              {deviceDetailQuery.isLoading ? (
                <p className="text-sm text-[var(--text-secondary)]">{t('adminStock.deviceModal.loading')}</p>
              ) : deviceDetailQuery.isError ? (
                <div className="space-y-2">
                  <p className="text-sm text-[var(--error-main)]">{t('adminStock.deviceModal.error')}</p>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => deviceDetailQuery.refetch()}>
                    {t('adminStock.deviceModal.retry')}
                  </button>
                </div>
              ) : !selectedDeviceDetail ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('adminStock.deviceModal.empty')}
                </p>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-[var(--text-secondary)]">{selectedDeviceDetail.system.code}</p>
                      <h3 className="text-lg font-semibold text-[var(--text-primary)]">{selectedDeviceDetail.macAddress}</h3>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-outline">{selectedDeviceDetail.status}</span>
                    <span className="badge badge-outline">{selectedDeviceDetail.warehouseCode}</span>
                    <span className={`badge ${selectedDeviceDetail.isConfigured ? 'badge-success' : 'badge-warning'}`}>
                      {selectedDeviceDetail.isConfigured ? 'Configure' : 'Pret a configurer'}
                    </span>
                  </div>

                  <div className="grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-2">
                    <p>Proprietaire: {selectedDeviceDetail.ownerEmail ?? 'Aucun'}</p>
                    <p>Creation: {formatDateTime(selectedDeviceDetail.createdAt)}</p>
                    <p>Nom: {selectedDeviceDetail.configuredName ?? '-'}</p>
                    <p>Emplacement: {selectedDeviceDetail.configuredLocation ?? '-'}</p>
                    <p>Assignation: {selectedDeviceDetail.assignedAt ? formatDateTime(selectedDeviceDetail.assignedAt) : '-'}</p>
                    {selectedDeviceDetail.system.code === 'FEEDBACK' ? (
                      <p>QR Token: {selectedDeviceDetail.qrCodeToken ?? '-'}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Extensions liees</p>
                    {selectedDeviceIdentifiers.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">Aucune extension liee.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedDeviceIdentifiers.map((identifier) => (
                          <span key={identifier.id} className="badge badge-outline">
                            {identifier.physicalIdentifier}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                      Historique mouvements
                    </p>
                    {selectedDeviceMovements.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">Aucun mouvement enregistre.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDeviceMovements.slice(0, 8).map((movement) => (
                          <div key={movement.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2 text-xs">
                            <p className="font-medium text-[var(--text-primary)]">
                              {movement.action} ({movement.resourceType})
                            </p>
                            <p className="text-[var(--text-secondary)]">
                              {movement.fromStatus ?? '-'} {'->'} {movement.toStatus ?? '-'} | {formatDateTime(movement.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Journal admin lie</p>
                    {selectedDeviceLogs.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">Aucune action admin liee.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDeviceLogs.slice(0, 6).map((log) => (
                          <div key={log.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2 text-xs">
                            <p className="font-medium text-[var(--text-primary)]">{log.action}</p>
                            <p className="text-[var(--text-secondary)]">
                              {log.actor?.email ?? 'acteur inconnu'} - {formatDateTime(log.createdAt)}
                            </p>
                            {formatAuditDetails(log.details) ? (
                              <p className="line-clamp-2 text-[var(--text-secondary)]">
                                Details: {formatAuditDetails(log.details)}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
