import { CheckCircle2 } from 'lucide-react';
import { useAdminStockImportsModule } from '../hooks/modules/useAdminStockImportsModule';

export function ImportsSection() {
  const {
    t,
    systems,
    importStep,
    provisionMode,
    handleProvisionModeChange,
    importSystemId,
    handleImportSystemChange,
    importWarehouseCode,
    setImportWarehouseCode,
    selectedImportSystem,
    requiredIdentifiersPerDevice,
    selectedImportIdentifierLabel,
    manualMacAddress,
    setManualMacAddress,
    manualIdentifierInput,
    setManualIdentifierInput,
    normalizePhysicalIdentifierInput,
    manualIdentifiers,
    setManualIdentifiers,
    handleAddManualIdentifier,
    handleRemoveManualIdentifier,
    manualBatchDevices,
    handleAddManualDevice,
    handleRemoveManualDevice,
    importRawInput,
    setImportRawInput,
    handleImportFile,
    draftRows,
    importValidation,
    importIssuesPreview,
    validateImportMutation,
    createDevicesMutation,
    handleVerifyImport,
    handleConfirmImport,
    resetProvisionDraft,
    extensionProvisionMode,
    handleExtensionProvisionModeChange,
    extensionSystemId,
    handleExtensionSystemChange,
    extensionCapableSystems,
    extensionWarehouseCode,
    setExtensionWarehouseCode,
    selectedExtensionSystem,
    selectedExtensionIdentifierLabel,
    manualExtensionInput,
    setManualExtensionInput,
    handleAddManualExtension,
    handleRemoveManualExtension,
    manualExtensionBatch,
    handleExtensionImportFile,
    extensionRawInput,
    setExtensionRawInput,
    extensionDraftIdentifiers,
    duplicateExtensionIdentifiers,
    invalidExtensionIdentifiers,
    readyExtensionCount,
    createExtensionsMutation,
    handleConfirmExtensions,
    resetExtensionDraft,
  } = useAdminStockImportsModule();

  return (
    <>
      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${importStep >= 1 ? 'badge-info' : 'badge-outline'}`}>
              1. {t('adminStock.steps.import')}
            </span>
            <span className={`badge ${importStep >= 2 ? 'badge-info' : 'badge-outline'}`}>
              2. {t('adminStock.steps.verify')}
            </span>
            <span className={`badge ${importStep >= 3 ? 'badge-success' : 'badge-outline'}`}>
              3. {t('adminStock.steps.confirm')}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {t('adminStock.provisioning.title')}
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('adminStock.provisioning.description')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn btn-sm ${provisionMode === 'manual' ? 'btn-info text-[var(--app-bg)]' : 'btn-outline'}`}
              onClick={() => handleProvisionModeChange('manual')}
            >
              {t('adminStock.mode.manual')}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${provisionMode === 'csv' ? 'btn-info text-[var(--app-bg)]' : 'btn-outline'}`}
              onClick={() => handleProvisionModeChange('csv')}
            >
              {t('adminStock.mode.csv')}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">
                {t('adminStock.labels.system')}
              </span>
              <select
                className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                value={importSystemId}
                onChange={(event) => handleImportSystemChange(event.target.value)}
              >
                <option value="">{t('adminStock.labels.select')}</option>
                {systems.map((system) => (
                  <option key={system.id} value={system.id}>
                    {system.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">
                {t('adminStock.labels.warehouse')}
              </span>
              <input
                className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                value={importWarehouseCode}
                onChange={(event) => setImportWarehouseCode(event.target.value.toUpperCase())}
                placeholder="MAIN"
              />
            </label>
            <div className="text-xs text-[var(--text-secondary)]">
              {selectedImportSystem
                ? selectedImportSystem.hasIdentifiers
                  ? `${requiredIdentifiersPerDevice} identifiant(s) ${selectedImportIdentifierLabel} requis par boitier.`
                  : 'Aucun identifiant attendu pour ce systeme.'
                : 'Selectionnez un systeme.'}
            </div>
          </div>

          {provisionMode === 'manual' ? (
            <div className="space-y-4 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
              {selectedImportSystem ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="form-control">
                      <span className="label-text text-xs text-[var(--text-secondary)]">Adresse MAC du boitier</span>
                      <input
                        className="input input-bordered mt-1 bg-[var(--card-bg)] font-mono"
                        placeholder="AA:70:31:00:00:01"
                        value={manualMacAddress}
                        onChange={(event) => setManualMacAddress(event.target.value.toUpperCase())}
                      />
                    </label>
                    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--card-bg)] p-3">
                      <p className="text-xs text-[var(--text-secondary)]">Boitiers dans le lot</p>
                      <p className="text-xl font-semibold text-[var(--text-primary)]">
                        {manualBatchDevices.length}
                      </p>
                    </div>
                  </div>

                  {selectedImportSystem.hasIdentifiers ? (
                    <div className="space-y-3">
                      <p className="text-sm text-[var(--text-secondary)]">
                        {selectedImportIdentifierLabel} ({manualIdentifiers.length}/{requiredIdentifiersPerDevice})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <input
                          className="input input-bordered grow bg-[var(--card-bg)] font-mono"
                          placeholder={`Identifiant ${selectedImportIdentifierLabel}`}
                          value={manualIdentifierInput}
                          onChange={(event) =>
                            setManualIdentifierInput(normalizePhysicalIdentifierInput(event.target.value))
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleAddManualIdentifier();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-outline btn-info"
                          onClick={handleAddManualIdentifier}
                          disabled={
                            !manualIdentifierInput.trim() ||
                            manualIdentifiers.length >= requiredIdentifiersPerDevice
                          }
                        >
                          OK
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {manualIdentifiers.length === 0 ? (
                          <p className="text-xs text-[var(--text-secondary)]">
                            Ajoutez les identifiants un a un.
                          </p>
                        ) : (
                          manualIdentifiers.map((identifier) => (
                            <button
                              key={identifier}
                              type="button"
                              className="badge badge-outline gap-2 px-2 py-3"
                              onClick={() => handleRemoveManualIdentifier(identifier)}
                              title="Retirer cette extension"
                            >
                              {identifier}
                              <span aria-hidden="true">x</span>
                            </button>
                          ))
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Format accepte: MAC (AA:BB:CC:DD:EE:FF) ou code alphanumerique (A-Z, 0-9, -, _, :).
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      Ce systeme ne demande aucune extension.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">
                  Selectionnez un systeme pour afficher la saisie MAC.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-info text-[var(--app-bg)]"
                  disabled={!importSystemId}
                  onClick={handleAddManualDevice}
                >
                  {t('adminStock.actions.addDevice')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setManualMacAddress('');
                    setManualIdentifierInput('');
                    setManualIdentifiers([]);
                  }}
                >
                  {t('adminStock.actions.resetInput')}
                </button>
              </div>

              {manualBatchDevices.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>MAC</th>
                        <th>Extensions</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualBatchDevices.map((device, index) => (
                        <tr key={`${device.macAddress}-${index}`}>
                          <td>{index + 1}</td>
                          <td className="font-mono text-xs">{device.macAddress}</td>
                          <td className="font-mono text-xs">
                            {(device.identifiers ?? []).join(', ') || '-'}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => handleRemoveManualDevice(index)}
                            >
                              Retirer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs text-[var(--text-secondary)]">
                Format attendu: MAC boitier puis identifiants. Exemple:
                {' '}
                {selectedImportSystem?.hasIdentifiers
                  ? 'AA:70:31:00:00:01,BADGE-001,BADGE-002,BADGE-003,BADGE-004,BADGE-005'
                  : 'AA:70:34:00:00:01'}
              </p>
              <input
                type="file"
                accept=".csv,.txt,.xlsx"
                className="file-input file-input-bordered file-input-sm w-full max-w-sm bg-[var(--card-bg)]"
                onChange={handleImportFile}
              />
              <textarea
                className="textarea textarea-bordered min-h-36 bg-[var(--card-bg)] font-mono text-xs"
                placeholder="AA:70:31:00:00:01,AA:70:31:00:10:01,AA:70:31:00:10:02,AA:70:31:00:10:03,AA:70:31:00:10:04,AA:70:31:00:10:05"
                value={importRawInput}
                onChange={(event) => setImportRawInput(event.target.value)}
              />
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Lignes detectees</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">{draftRows.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Lignes valides</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">{importValidation?.summary.validRows ?? '-'}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Lignes invalides</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">{importValidation?.summary.invalidRows ?? '-'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-info text-[var(--app-bg)]"
              disabled={validateImportMutation.isPending || createDevicesMutation.isPending}
              onClick={handleVerifyImport}
            >
              {validateImportMutation.isPending
                ? t('adminStock.actions.verifying')
                : t('adminStock.actions.verify')}
            </button>
            <button
              type="button"
              className="btn btn-success"
              disabled={!importValidation?.canCommit || createDevicesMutation.isPending}
              onClick={handleConfirmImport}
            >
              <CheckCircle2 className="h-4 w-4" />
              {createDevicesMutation.isPending
                ? t('adminStock.actions.confirming')
                : t('adminStock.actions.confirm')}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={resetProvisionDraft}
            >
              {t('adminStock.actions.clearBatch')}
            </button>
          </div>

          {importValidation && importIssuesPreview.length > 0 ? (
            <div className="rounded-lg border border-[var(--warning-main)]/40 bg-[var(--warning-main)]/10 p-3 text-sm">
              <p className="font-medium text-[var(--text-primary)]">
                Erreurs a corriger avant confirmation
              </p>
              <ul className="mt-2 space-y-1 text-[var(--text-secondary)]">
                {importIssuesPreview.map((issue) => (
                  <li key={`${issue.rowNumber}-${issue.code}`}>
                    Ligne {issue.rowNumber} - {issue.code}: {issue.message}
                  </li>
                ))}
              </ul>
              {importValidation.summary.invalidRows > importIssuesPreview.length ? (
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  +{importValidation.summary.invalidRows - importIssuesPreview.length} erreur(s) supplementaire(s) dans le tableau de verification.
                </p>
              ) : null}
            </div>
          ) : null}

          {importValidation?.canCommit ? (
            <div className="rounded-lg border border-[var(--success-main)]/40 bg-[var(--success-main)]/10 p-3 text-sm text-[var(--text-primary)]">
              Lot valide. Cliquez sur <strong>Confirmer</strong> pour rendre ce materiel vendable dans le marketplace.
            </div>
          ) : null}

          {importValidation ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>MAC</th>
                    <th>Entrepot</th>
                    <th>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {importValidation.rows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td className="font-mono text-xs">{row.macAddress || '-'}</td>
                      <td>{row.warehouseCode}</td>
                      <td>
                        {row.issues.length === 0 ? (
                          <span className="badge badge-success badge-sm">OK</span>
                        ) : (
                          row.issues.map((issue) => (
                            <span key={`${row.rowNumber}-${issue.code}`} className="badge badge-warning badge-sm mr-1">
                              {issue.code}
                            </span>
                          ))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body space-y-4 p-5">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {t('adminStock.extensions.title')}
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('adminStock.extensions.description')}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn btn-sm ${extensionProvisionMode === 'manual' ? 'btn-info text-[var(--app-bg)]' : 'btn-outline'}`}
              onClick={() => handleExtensionProvisionModeChange('manual')}
            >
              {t('adminStock.mode.manual')}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${extensionProvisionMode === 'csv' ? 'btn-info text-[var(--app-bg)]' : 'btn-outline'}`}
              onClick={() => handleExtensionProvisionModeChange('csv')}
            >
              {t('adminStock.mode.csv')}
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">Systeme extension</span>
              <select
                className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                value={extensionSystemId}
                onChange={(event) => handleExtensionSystemChange(event.target.value)}
              >
                <option value="">Selectionner</option>
                {extensionCapableSystems.map((system) => (
                  <option key={system.id} value={system.id}>
                    {system.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">Entrepot</span>
              <input
                className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                value={extensionWarehouseCode}
                onChange={(event) => setExtensionWarehouseCode(event.target.value.toUpperCase())}
                placeholder="MAIN"
              />
            </label>
            <div className="text-xs text-[var(--text-secondary)]">
              {selectedExtensionSystem
                ? `Type attendu: ${selectedExtensionIdentifierLabel} (${selectedExtensionSystem.identifierType ?? 'N/A'})`
                : 'Selectionnez un systeme qui supporte les extensions.'}
            </div>
          </div>

          {extensionProvisionMode === 'manual' ? (
            <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
              {selectedExtensionSystem ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="input input-bordered grow bg-[var(--card-bg)] font-mono"
                      placeholder={`Identifiant ${selectedExtensionIdentifierLabel}`}
                      value={manualExtensionInput}
                      onChange={(event) =>
                        setManualExtensionInput(normalizePhysicalIdentifierInput(event.target.value))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleAddManualExtension();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-info"
                      onClick={handleAddManualExtension}
                      disabled={!manualExtensionInput.trim()}
                    >
                      OK
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {manualExtensionBatch.length === 0 ? (
                      <p className="text-xs text-[var(--text-secondary)]">
                        Saisissez un identifiant puis cliquez sur OK.
                      </p>
                    ) : (
                      manualExtensionBatch.map((identifier) => (
                        <button
                          key={identifier}
                          type="button"
                          className="badge badge-outline gap-2 px-2 py-3"
                          onClick={() => handleRemoveManualExtension(identifier)}
                          title="Retirer cette extension"
                        >
                          {identifier}
                          <span aria-hidden="true">x</span>
                        </button>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Format accepte: MAC (AA:BB:CC:DD:EE:FF) ou code alphanumerique (A-Z, 0-9, -, _, :).
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">
                  Selectionnez un systeme pour afficher la saisie des extensions.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs text-[var(--text-secondary)]">
                Format attendu: un identifiant par ligne (ou 1ere colonne CSV).
              </p>
              <input
                type="file"
                accept=".csv,.txt,.xlsx"
                className="file-input file-input-bordered file-input-sm w-full max-w-sm bg-[var(--card-bg)]"
                onChange={handleExtensionImportFile}
              />
              <textarea
                className="textarea textarea-bordered min-h-32 bg-[var(--card-bg)] font-mono text-xs"
                placeholder={'AA:70:31:00:10:01\nAA:70:31:00:10:02\nAA:70:31:00:10:03'}
                value={extensionRawInput}
                onChange={(event) => setExtensionRawInput(event.target.value)}
              />
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Extensions detectees</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">
                {extensionDraftIdentifiers.length}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Doublons</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">
                {duplicateExtensionIdentifiers.length}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Pret a confirmer</p>
              <p className="text-xl font-semibold text-[var(--text-primary)]">
                {readyExtensionCount}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-info text-[var(--app-bg)]"
              disabled={
                createExtensionsMutation.isPending ||
                !selectedExtensionSystem ||
                extensionDraftIdentifiers.length === 0 ||
                duplicateExtensionIdentifiers.length > 0 ||
                invalidExtensionIdentifiers.length > 0
              }
              onClick={handleConfirmExtensions}
            >
              {createExtensionsMutation.isPending
                ? t('adminStock.actions.confirmingExtensions')
                : t('adminStock.actions.confirmExtensions')}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={resetExtensionDraft}
            >
              {t('adminStock.actions.clearExtensionsBatch')}
            </button>
          </div>

          {duplicateExtensionIdentifiers.length > 0 ? (
            <div className="rounded-lg border border-[var(--warning-main)]/40 bg-[var(--warning-main)]/10 p-3 text-sm text-[var(--text-primary)]">
              Doublons detectes: {duplicateExtensionIdentifiers.slice(0, 6).join(', ')}
              {duplicateExtensionIdentifiers.length > 6
                ? ` (+${duplicateExtensionIdentifiers.length - 6} autres)`
                : ''}
            </div>
          ) : null}

          {invalidExtensionIdentifiers.length > 0 ? (
            <div className="rounded-lg border border-[var(--error-main)]/40 bg-[var(--error-main)]/10 p-3 text-sm text-[var(--text-primary)]">
              Identifiants invalides: {invalidExtensionIdentifiers.slice(0, 6).join(', ')}
              {invalidExtensionIdentifiers.length > 6
                ? ` (+${invalidExtensionIdentifiers.length - 6} autres)`
                : ''}
            </div>
          ) : null}

          {extensionDraftIdentifiers.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ID extension</th>
                  </tr>
                </thead>
                <tbody>
                  {extensionDraftIdentifiers.slice(0, 80).map((identifier, index) => (
                    <tr key={`${identifier}-${index}`}>
                      <td>{index + 1}</td>
                      <td className="font-mono text-xs">{identifier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {extensionDraftIdentifiers.length > 80 ? (
                <p className="px-3 pb-3 text-xs text-[var(--text-secondary)]">
                  Apercu limite a 80 lignes.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {createDevicesMutation.isSuccess ? (
        <div className="alert border-[var(--success-main)]/40 bg-[var(--success-main)]/10 text-[var(--text-primary)]">
          <CheckCircle2 className="h-4 w-4" />
          <span>{t('adminStock.success.allocationReady')}</span>
        </div>
      ) : null}
    </>
  );
}
