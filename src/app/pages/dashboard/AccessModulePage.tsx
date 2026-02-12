import { ArrowRightLeft, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useMarketplace, useServices } from '@/app/contexts';
import { formatDateTime } from '@/app/services';
import type { ModuleKey } from '@/app/types';
import { DeviceSetupCard, EmptyState, PageHeader } from '@/app/shared/components';
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
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  const {
    devices,
    inventory,
    configureDevice,
    getDevicesByModule,
    getAvailableIdentifiersByModule,
    getInventoryById,
  } = useMarketplace();
  const {
    assignIdentifier,
    removeAssignment,
    reassignIdentifier,
    getAssignmentsByModule,
    getEmployeeById,
    getHistoryByModule,
  } = useServices();

  const content = moduleContent[module];

  const moduleDevices = getDevicesByModule(module, false);
  const pendingDevices = moduleDevices.filter((device) => !device.configured);
  const configuredDevices = moduleDevices.filter((device) => device.configured);

  const availableIdentifiers = getAvailableIdentifiersByModule(module);
  const moduleAssignments = getAssignmentsByModule(module);
  const moduleHistory = getHistoryByModule(module).slice(0, 25);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AssignmentFormValues>();

  useEffect(() => {
    if (!configuredDevices.length) {
      return;
    }

    setValue('deviceId', configuredDevices[0].id);
  }, [configuredDevices, setValue]);

  const editingAssignment = useMemo(
    () => moduleAssignments.find((assignment) => assignment.id === editingAssignmentId),
    [moduleAssignments, editingAssignmentId],
  );

  const identifierOptions = useMemo(() => {
    if (!editingAssignment) {
      return availableIdentifiers;
    }

    const currentIdentifier = getInventoryById(editingAssignment.identifierId);

    if (!currentIdentifier) {
      return availableIdentifiers;
    }

    const merged = [currentIdentifier, ...availableIdentifiers];
    const dedupMap = new Map(merged.map((identifier) => [identifier.id, identifier]));
    return Array.from(dedupMap.values());
  }, [editingAssignment, availableIdentifiers, getInventoryById]);

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

  const handleConfigureDevice = (deviceId: string, values: { name: string; location: string }) => {
    try {
      configureDevice(deviceId, values);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Configuration impossible.';
      toast.error(message);
    }
  };

  const onSubmit = async (values: AssignmentFormValues) => {
    try {
      if (!editingAssignmentId) {
        assignIdentifier({
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

      reassignIdentifier({
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
      const message = error instanceof Error ? error.message : 'Operation impossible.';
      toast.error(message);
    }
  };

  const handleRemoveAssignment = (assignmentId: string) => {
    try {
      removeAssignment(assignmentId);
      if (editingAssignmentId === assignmentId) {
        setEditingAssignmentId(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Suppression impossible.';
      toast.error(message);
    }
  };

  if (moduleDevices.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={content.title} description={content.description} />
        <EmptyState
          title="Aucun boitier achete"
          description="Ce module est disponible apres achat dans le Marketplace."
          action={
            <button type="button" className="btn btn-info text-[var(--app-bg)]" onClick={() => navigate('/dashboard/marketplace')}>
              Ouvrir le Marketplace
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={content.title}
        description={content.description}
        actions={
          <button type="button" className="btn btn-outline btn-info" onClick={() => navigate('/dashboard/marketplace')}>
            Acheter des identifiants
          </button>
        }
      />

      {pendingDevices.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm uppercase tracking-[0.2em] text-[var(--warning-main)]">Configuration des boitiers</h2>
          <div className="grid gap-4">
            {pendingDevices.map((device) => (
              <DeviceSetupCard key={device.id} device={device} onConfigure={handleConfigureDevice} />
            ))}
          </div>
        </section>
      )}

      {configuredDevices.length === 0 ? (
        <EmptyState
          title="Configuration requise"
          description="Finalisez au moins un boitier pour activer ce service dans la sidebar et demarrer les assignations."
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
                    <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
                      <div className="rounded-lg bg-[var(--surface-muted)] p-3">
                        <p className="text-[var(--text-secondary)]">Capacite</p>
                        <p className="text-lg font-bold text-[var(--text-primary)]">{capacity}</p>
                      </div>
                      <div className="rounded-lg bg-[var(--surface-muted)] p-3">
                        <p className="text-[var(--text-secondary)]">Associes</p>
                        <p className="text-lg font-bold text-[var(--success-main)]">{assigned}</p>
                      </div>
                      <div className="rounded-lg bg-[var(--surface-muted)] p-3">
                        <p className="text-[var(--text-secondary)]">Restants</p>
                        <p className="text-lg font-bold text-[var(--accent-primary)]">{Math.max(capacity - assigned, 0)}</p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
            <div className="card-body p-5">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {editingAssignmentId ? 'Reattribuer un identifiant' : `Associer un ${content.assignmentLabel}`}
              </h2>

              <form className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleSubmit(onSubmit)}>
                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">Prenom</span>
                  <input
                    className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                    {...register('firstName', { required: 'Prenom requis' })}
                  />
                  {errors.firstName ? (
                    <span className="mt-1 text-xs text-[var(--error-main)]">{errors.firstName.message}</span>
                  ) : null}
                </label>

                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">Nom</span>
                  <input
                    className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                    {...register('lastName', { required: 'Nom requis' })}
                  />
                  {errors.lastName ? (
                    <span className="mt-1 text-xs text-[var(--error-main)]">{errors.lastName.message}</span>
                  ) : null}
                </label>

                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">Boitier</span>
                  <select
                    className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                    {...register('deviceId', { required: 'Boitier requis' })}
                  >
                    <option value="">Selectionner</option>
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
                  <span className="label-text text-xs text-[var(--text-secondary)]">Identifiant</span>
                  <select
                    className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                    disabled={Boolean(editingAssignmentId)}
                    {...register('identifierId', { required: 'Identifiant requis' })}
                  >
                    <option value="">Selectionner</option>
                    {identifierOptions.map((identifier) => (
                      <option key={identifier.id} value={identifier.id}>
                        {identifier.code}
                      </option>
                    ))}
                  </select>
                  {errors.identifierId ? (
                    <span className="mt-1 text-xs text-[var(--error-main)]">{errors.identifierId.message}</span>
                  ) : null}
                </label>

                <div className="flex items-center gap-2 xl:col-span-4">
                  <button type="submit" className="btn btn-info text-[var(--app-bg)]" disabled={isSubmitting}>
                    {editingAssignmentId ? 'Valider la reattribution' : 'Associer'}
                  </button>

                  {editingAssignmentId ? (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        setEditingAssignmentId(null);
                        reset({ firstName: '', lastName: '', deviceId: configuredDevices[0]?.id ?? '', identifierId: '' });
                      }}
                    >
                      Annuler
                    </button>
                  ) : null}

                  {!identifierOptions.length ? (
                    <span className="text-xs text-[var(--warning-main)]">
                      Aucun identifiant disponible. Achetez un pack supplementaire.
                    </span>
                  ) : null}
                </div>
              </form>
            </div>
          </section>

          <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
            <div className="card-body p-0">
              <div className="px-5 py-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Associations actives</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Identifiant</th>
                      <th>Boitier</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {moduleAssignments.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-sm text-[var(--text-secondary)]">
                          Aucune association active.
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
                          <td>{formatDateTime(assignment.updatedAt)}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="btn btn-xs btn-outline"
                                onClick={() => setEditingAssignmentId(assignment.id)}
                              >
                                <ArrowRightLeft className="h-3 w-3" />
                                Reattribuer
                              </button>
                              <button
                                type="button"
                                className="btn btn-xs btn-outline btn-error"
                                onClick={() => handleRemoveAssignment(assignment.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                                Retirer
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
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Historique du module</h2>
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
                    {moduleHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-sm text-[var(--text-secondary)]">
                          Aucun evenement trace.
                        </td>
                      </tr>
                    )}
                    {moduleHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDateTime(entry.occurredAt)}</td>
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
    </div>
  );
}
