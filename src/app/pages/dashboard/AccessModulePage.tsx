import { ArrowRightLeft, Download, History, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MODULE_LABEL_KEYS } from '@/app/data';
import { useI18n, useMarketplace, useServices } from '@/app/contexts';
import { downloadDeviceHistoryPdf, formatDateTime } from '@/app/services';
import type { ModuleKey } from '@/app/types';
import {
  DeviceHistoryDialog,
  DeviceSetupCard,
  EmptyState,
  PageHeader,
  type DeviceHistoryDialogEntry,
} from '@/app/shared/components';
import { moduleContent } from './moduleConfig';

interface AccessModulePageProps {
  module: Exclude<ModuleKey, 'feedback'>;
}

interface AssignmentFormValues {
  firstName: string;
  lastName: string;
  deviceId: string;
  identifierId: string;
}

export function AccessModulePage({ module }: AccessModulePageProps) {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [historyDeviceId, setHistoryDeviceId] = useState<string | null>(null);

  const {
    devices,
    inventory,
    configureDevice,
    getDevicesByModule,
    getInventoryById,
  } = useMarketplace();
  const {
    assignIdentifier,
    removeAssignment,
    reassignIdentifier,
    getAssignmentsByModule,
    getEmployeeById,
    getHistoryByDevice,
    getHistoryByModule,
  } = useServices();

  const content = moduleContent[module];
  const contentTitle = t(content.titleKey);
  const contentDescription = t(content.descriptionKey);
  const assignmentLabel = t(content.assignmentLabelKey);

  const moduleDevices = getDevicesByModule(module, false);
  const pendingDevices = moduleDevices.filter((device) => !device.configured);
  const configuredDevices = moduleDevices.filter((device) => device.configured);

  const moduleAssignments = getAssignmentsByModule(module);
  const moduleHistory = getHistoryByModule(module).slice(0, 25);

  const selectedHistoryDevice = useMemo(
    () => configuredDevices.find((device) => device.id === historyDeviceId) ?? null,
    [configuredDevices, historyDeviceId],
  );

  const selectedDeviceHistory = useMemo<ReadonlyArray<DeviceHistoryDialogEntry>>(
    () =>
      selectedHistoryDevice
        ? getHistoryByDevice(selectedHistoryDevice.id, module).map((entry) => ({
            id: entry.id,
            occurredAt: entry.occurredAt,
            actor: entry.employee,
            identifier: entry.identifier,
            action: entry.action,
          }))
        : [],
    [selectedHistoryDevice, getHistoryByDevice, module],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AssignmentFormValues>();
  const selectedAssignmentDeviceId = watch('deviceId');
  const selectedAssignmentIdentifierId = watch('identifierId');

  useEffect(() => {
    if (!configuredDevices.length) {
      return;
    }

    if (
      selectedAssignmentDeviceId &&
      configuredDevices.some((device) => device.id === selectedAssignmentDeviceId)
    ) {
      return;
    }

    setValue('deviceId', configuredDevices[0].id);
  }, [configuredDevices, selectedAssignmentDeviceId, setValue]);

  const editingAssignment = useMemo(
    () => moduleAssignments.find((assignment) => assignment.id === editingAssignmentId),
    [moduleAssignments, editingAssignmentId],
  );

  const identifiersForSelectedDevice = useMemo(
    () => {
      if (!selectedAssignmentDeviceId) {
        return [];
      }

      const deviceIdentifiers = inventory.filter(
        (identifier) =>
          identifier.module === module &&
          identifier.deviceId === selectedAssignmentDeviceId,
      );
      const extraAvailableIdentifiers = inventory.filter(
        (identifier) =>
          identifier.module === module &&
          !identifier.deviceId &&
          identifier.status === 'available',
      );

      const merged = [...deviceIdentifiers, ...extraAvailableIdentifiers];
      const dedupMap = new Map(merged.map((identifier) => [identifier.id, identifier]));
      return Array.from(dedupMap.values());
    },
    [inventory, module, selectedAssignmentDeviceId],
  );

  const availableMarketplaceExtensionsCount = useMemo(
    () =>
      inventory.filter(
        (identifier) =>
          identifier.module === module &&
          !identifier.deviceId &&
          identifier.status === 'available',
      ).length,
    [inventory, module],
  );

  const identifierOptions = useMemo(() => {
    if (!editingAssignment) {
      return identifiersForSelectedDevice;
    }

    const currentIdentifier = getInventoryById(editingAssignment.identifierId);

    if (!currentIdentifier) {
      return identifiersForSelectedDevice;
    }

    const merged = [currentIdentifier, ...identifiersForSelectedDevice];
    const dedupMap = new Map(merged.map((identifier) => [identifier.id, identifier]));
    return Array.from(dedupMap.values());
  }, [editingAssignment, getInventoryById, identifiersForSelectedDevice]);

  useEffect(() => {
    if (editingAssignmentId) {
      return;
    }

    if (!selectedAssignmentIdentifierId) {
      return;
    }

    const stillSelectable = identifierOptions.some(
      (identifier) =>
        identifier.id === selectedAssignmentIdentifierId &&
        identifier.status === 'available',
    );
    if (!stillSelectable) {
      setValue('identifierId', '');
    }
  }, [editingAssignmentId, identifierOptions, selectedAssignmentIdentifierId, setValue]);

  useEffect(() => {
    if (!editingAssignment) {
      return;
    }

    const employee = getEmployeeById(editingAssignment.employeeId);
    if (!employee) {
      return;
    }

    setValue('firstName', employee.firstName);
    setValue('lastName', employee.lastName);
    setValue('deviceId', editingAssignment.deviceId);
    setValue('identifierId', editingAssignment.identifierId);
  }, [editingAssignment, getEmployeeById, setValue]);

  const handleConfigureDevice = async (
    deviceId: string,
    values: { name?: string; location: string; systemIdentifier: string },
  ): Promise<boolean> => {
    try {
      await configureDevice(deviceId, values);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : t('access.errors.activationImpossible');
      toast.error(message);
      return false;
    }
  };

  const onSubmit = async (values: AssignmentFormValues) => {
    try {
      if (!editingAssignmentId) {
        const selectedIdentifier = identifierOptions.find(
          (identifier) => identifier.id === values.identifierId,
        );
        if (!selectedIdentifier || selectedIdentifier.status !== 'available') {
          toast.error(t('access.form.noIdentifierAvailable'));
          return;
        }

        await assignIdentifier({
          module,
          deviceId: values.deviceId,
          identifierId: values.identifierId,
          firstName: values.firstName,
          lastName: values.lastName,
        });
        reset({
          firstName: '',
          lastName: '',
          deviceId: values.deviceId,
          identifierId: '',
        });
        return;
      }

      await reassignIdentifier({
        assignmentId: editingAssignmentId,
        deviceId: values.deviceId,
        firstName: values.firstName,
        lastName: values.lastName,
      });
      setEditingAssignmentId(null);
      reset({
        firstName: '',
        lastName: '',
        deviceId: values.deviceId,
        identifierId: '',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('access.errors.operationImpossible');
      toast.error(message);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await removeAssignment(assignmentId);
      if (editingAssignmentId === assignmentId) {
        setEditingAssignmentId(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('access.errors.deleteImpossible');
      toast.error(message);
    }
  };

  const handleDownloadDeviceHistoryPdf = (
    deviceId: string,
    options?: { forceCloseAfterExport?: boolean },
  ) => {
    const device = configuredDevices.find((candidate) => candidate.id === deviceId);

    if (!device) {
      toast.error(t('access.errors.deviceNotFound'));
      return;
    }

    const entries = getHistoryByDevice(device.id, module).map((entry) => ({
      occurredAt: entry.occurredAt,
      actor: entry.employee,
      identifier: entry.identifier,
      action: entry.action,
    }));

    downloadDeviceHistoryPdf({
      moduleLabel: t(MODULE_LABEL_KEYS[module]),
      deviceName: device.name,
      deviceId: device.id,
      systemIdentifier: device.systemIdentifier,
      generatedAt: new Date().toISOString(),
      entries,
    });

    if (options?.forceCloseAfterExport) {
      setHistoryDeviceId(null);
    }
  };

  if (moduleDevices.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={contentTitle} description={contentDescription} />
        <EmptyState
          title={t('access.empty.noDevice.title')}
          description={t('access.empty.noDevice.description')}
          action={
            <button
              type="button"
              className="btn btn-info text-[var(--app-bg)]"
              onClick={() => navigate('/dashboard/marketplace')}
            >
              {t('access.empty.noDevice.action')}
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={contentTitle}
        description={contentDescription}
        actions={
          <button
            type="button"
            className="btn btn-outline btn-info"
            onClick={() => navigate('/dashboard/marketplace')}
          >
            {t('access.actions.buyIdentifiers')}
          </button>
        }
      />

      {pendingDevices.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm uppercase tracking-[0.2em] text-[var(--warning-main)]">
            {t('access.pendingActivation.title')}
          </h2>
          <div className="grid gap-4">
            {pendingDevices.map((device) => (
              <DeviceSetupCard key={device.id} device={device} onConfigure={handleConfigureDevice} />
            ))}
          </div>
        </section>
      )}

      {configuredDevices.length === 0 ? (
        <EmptyState
          title={t('access.empty.activationRequired.title')}
          description={t('access.empty.activationRequired.description')}
        />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {configuredDevices.map((device) => {
              const capacity = inventory.filter(
                (identifier) => identifier.module === module && identifier.deviceId === device.id,
              ).length;
              const assigned = moduleAssignments.filter((assignment) => assignment.deviceId === device.id).length;

              return (
                <article key={device.id} className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
                  <div className="card-body p-5">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">{device.name}</h3>
                    <p className="text-xs text-[var(--text-secondary)]">{device.location}</p>
                    <p className="mt-1 font-mono text-xs text-[var(--accent-primary)]">
                      MAC: {device.systemIdentifier ?? t('marketplace.stock.na')}
                    </p>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
                      <div className="rounded-lg bg-[var(--surface-muted)] p-3">
                        <p className="text-[var(--text-secondary)]">{t('access.deviceCard.capacity')}</p>
                        <p className="text-lg font-bold text-[var(--text-primary)]">{capacity}</p>
                      </div>
                      <div className="rounded-lg bg-[var(--surface-muted)] p-3">
                        <p className="text-[var(--text-secondary)]">{t('access.deviceCard.assigned')}</p>
                        <p className="text-lg font-bold text-[var(--success-main)]">{assigned}</p>
                      </div>
                      <div className="rounded-lg bg-[var(--surface-muted)] p-3">
                        <p className="text-[var(--text-secondary)]">{t('access.deviceCard.remaining')}</p>
                        <p className="text-lg font-bold text-[var(--accent-primary)]">
                          {Math.max(capacity - assigned, 0)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => setHistoryDeviceId(device.id)}
                      >
                        <History className="h-3 w-3" />
                        {t('common.history')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline btn-info"
                        onClick={() => handleDownloadDeviceHistoryPdf(device.id)}
                      >
                        <Download className="h-3 w-3" />
                        PDF
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
            <div className="card-body p-5">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {editingAssignmentId
                  ? t('access.form.reassignTitle')
                  : t('access.form.assignTitle', { label: assignmentLabel })}
              </h2>

              <form className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleSubmit(onSubmit)}>
                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">{t('form.firstName')}</span>
                  <input
                    className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                    {...register('firstName', { required: t('form.firstNameRequired') })}
                  />
                  {errors.firstName ? (
                    <span className="mt-1 text-xs text-[var(--error-main)]">{errors.firstName.message}</span>
                  ) : null}
                </label>

                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">{t('form.lastName')}</span>
                  <input
                    className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                    {...register('lastName', { required: t('form.lastNameRequired') })}
                  />
                  {errors.lastName ? (
                    <span className="mt-1 text-xs text-[var(--error-main)]">{errors.lastName.message}</span>
                  ) : null}
                </label>

                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">{t('table.device')}</span>
                  <select
                    className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                    {...register('deviceId', { required: t('access.form.deviceRequired') })}
                  >
                    <option value="">{t('form.select')}</option>
                    {configuredDevices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name}
                      </option>
                    ))}
                  </select>
                  {errors.deviceId ? (
                    <span className="mt-1 text-xs text-[var(--error-main)]">{errors.deviceId.message}</span>
                  ) : null}
                </label>

                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">{t('table.identifier')}</span>
                  <input
                    type="hidden"
                    {...register('identifierId', { required: t('access.form.identifierRequired') })}
                  />
                  {editingAssignmentId ? (
                    <div className="mt-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
                      <p className="font-mono text-xs text-[var(--accent-primary)]">
                        {identifierOptions.find((identifier) => identifier.id === selectedAssignmentIdentifierId)
                          ?.code ?? t('marketplace.stock.na')}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1 max-h-44 space-y-2 overflow-y-auto rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2">
                      {!selectedAssignmentDeviceId ? (
                        <p className="text-xs text-[var(--text-secondary)]">{t('access.form.deviceRequired')}</p>
                      ) : identifierOptions.length === 0 ? (
                        <p className="text-xs text-[var(--text-secondary)]">{t('access.form.noIdentifierAvailable')}</p>
                      ) : (
                        identifierOptions.map((identifier) => {
                          const isAssigned = identifier.status === 'assigned';
                          const isSelected = selectedAssignmentIdentifierId === identifier.id;

                          return (
                            <button
                              key={identifier.id}
                              type="button"
                              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition ${
                                isAssigned
                                  ? 'border-[var(--success-main)]/40 bg-[var(--success-main)]/10 text-[var(--success-main)]'
                                  : isSelected
                                    ? 'border-[var(--accent-primary)] bg-[var(--card-bg)] text-[var(--text-primary)]'
                                    : 'border-[var(--border-soft)] bg-[var(--card-bg)] text-[var(--text-primary)]'
                              }`}
                              disabled={isAssigned}
                              onClick={() =>
                                setValue('identifierId', identifier.id, { shouldDirty: true, shouldValidate: true })
                              }
                            >
                              <span className="font-mono text-xs">{identifier.code}</span>
                              <div className="flex items-center gap-1">
                                <span className={`badge badge-xs ${isAssigned ? 'badge-success' : 'badge-outline'}`}>
                                  {isAssigned ? 'Associe' : 'Disponible'}
                                </span>
                                <span
                                  className={`badge badge-xs ${
                                    identifier.deviceId ? 'badge-ghost' : 'badge-info badge-outline'
                                  }`}
                                >
                                  {identifier.deviceId
                                    ? t('access.form.identifierSource.bound')
                                    : t('access.form.identifierSource.pool')}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                  {!editingAssignmentId && selectedAssignmentDeviceId && availableMarketplaceExtensionsCount > 0 ? (
                    <span className="mt-1 text-xs text-[var(--info-main)]">
                      {t('access.form.marketplacePoolHint', {
                        count: availableMarketplaceExtensionsCount,
                      })}
                    </span>
                  ) : null}
                  {errors.identifierId ? (
                    <span className="mt-1 text-xs text-[var(--error-main)]">{errors.identifierId.message}</span>
                  ) : null}
                </label>

                <div className="flex items-center gap-2 xl:col-span-4">
                  <button type="submit" className="btn btn-info text-[var(--app-bg)]" disabled={isSubmitting}>
                    {editingAssignmentId ? t('access.form.validateReassign') : t('access.form.assign')}
                  </button>

                  {editingAssignmentId ? (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        setEditingAssignmentId(null);
                        reset({
                          firstName: '',
                          lastName: '',
                          deviceId: configuredDevices[0]?.id ?? '',
                          identifierId: '',
                        });
                      }}
                    >
                      {t('common.cancel')}
                    </button>
                  ) : null}

                  {!identifierOptions.length ? (
                    <span className="text-xs text-[var(--warning-main)]">{t('access.form.noIdentifierAvailable')}</span>
                  ) : null}
                </div>
              </form>
            </div>
          </section>

          <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
            <div className="card-body p-0">
              <div className="px-5 py-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  {t('access.activeAssignments.title')}
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('table.employee')}</th>
                      <th>{t('table.identifier')}</th>
                      <th>{t('table.device')}</th>
                      <th>{t('table.date')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {moduleAssignments.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-sm text-[var(--text-secondary)]">
                          {t('access.activeAssignments.none')}
                        </td>
                      </tr>
                    )}
                    {moduleAssignments.map((assignment) => {
                      const employee = getEmployeeById(assignment.employeeId);
                      const identifier = getInventoryById(assignment.identifierId);
                      const device = devices.find((candidate) => candidate.id === assignment.deviceId);

                      return (
                        <tr key={assignment.id}>
                          <td>{employee?.fullName ?? '-'}</td>
                          <td className="font-mono text-[var(--accent-primary)]">{identifier?.code ?? '-'}</td>
                          <td>{device?.name ?? '-'}</td>
                          <td>{formatDateTime(assignment.updatedAt, locale === 'fr' ? 'fr-FR' : 'en-US')}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="btn btn-xs btn-outline"
                                onClick={() => setEditingAssignmentId(assignment.id)}
                              >
                                <ArrowRightLeft className="h-3 w-3" />
                                {t('access.activeAssignments.reassign')}
                              </button>
                              <button
                                type="button"
                                className="btn btn-xs btn-outline btn-error"
                                onClick={() => {
                                  void handleRemoveAssignment(assignment.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                                {t('access.activeAssignments.remove')}
                              </button>
                            </div>
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
            <div className="card-body p-0">
              <div className="px-5 py-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('access.moduleHistory.title')}</h2>
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
                    {moduleHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-sm text-[var(--text-secondary)]">
                          {t('access.moduleHistory.none')}
                        </td>
                      </tr>
                    )}
                    {moduleHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDateTime(entry.occurredAt, locale === 'fr' ? 'fr-FR' : 'en-US')}</td>
                        <td>{entry.employee}</td>
                        <td className="font-mono text-[var(--accent-primary)]">{entry.identifier}</td>
                        <td>{entry.device}</td>
                        <td>{entry.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}

      {selectedHistoryDevice ? (
        <DeviceHistoryDialog
          moduleLabel={t(MODULE_LABEL_KEYS[module])}
          deviceName={selectedHistoryDevice.name}
          deviceId={selectedHistoryDevice.id}
          systemIdentifier={selectedHistoryDevice.systemIdentifier}
          entries={[...selectedDeviceHistory]}
          onClose={() => setHistoryDeviceId(null)}
          onDownloadPdf={() =>
            handleDownloadDeviceHistoryPdf(selectedHistoryDevice.id, { forceCloseAfterExport: false })
          }
        />
      ) : null}
    </div>
  );
}
