import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts';
import {
  adminService,
  type AdminBulkDeviceItem,
  type AdminSystemStock,
  type HardwareSystemCode,
  type IdentifierType,
} from '@/app/services';
import { EmptyState, PageHeader } from '@/app/shared/components';

const SYSTEM_CODE_OPTIONS: HardwareSystemCode[] = [
  'RFID_PRESENCE',
  'RFID_PORTE',
  'BIOMETRIE',
  'FEEDBACK',
];

function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseDevicesInput(
  systems: AdminSystemStock[],
  systemId: string,
  rawInput: string,
): AdminBulkDeviceItem[] {
  const system = systems.find((entry) => entry.id === systemId);
  if (!system) {
    throw new Error('Selectionnez un systeme valide.');
  }

  const rows = parseLines(rawInput);
  if (rows.length === 0) {
    throw new Error('Ajoutez au moins une ligne MAC.');
  }

  return rows.map((row, index) => {
    const parts = row
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const [macAddress, ...identifiers] = parts;

    if (!macAddress) {
      throw new Error(`Ligne ${index + 1}: adresse MAC manquante.`);
    }

    if (!system.hasIdentifiers) {
      return { macAddress };
    }

    if (identifiers.length !== system.identifiersPerDevice) {
      throw new Error(
        `Ligne ${index + 1}: ${system.identifiersPerDevice} identifiants requis pour ${system.name}.`,
      );
    }

    return {
      macAddress,
      identifiers,
    };
  });
}

export function AdminStockPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const normalizedRole = user?.roleName?.trim().toLowerCase();
  const canManageStock = normalizedRole === 'owner' || normalizedRole === 'admin';

  const systemsQuery = useQuery({
    queryKey: ['admin', 'systems'],
    queryFn: adminService.listSystems,
    enabled: canManageStock,
  });

  const systems = systemsQuery.data ?? [];

  const [deviceSystemId, setDeviceSystemId] = useState('');
  const [devicesRawInput, setDevicesRawInput] = useState('');

  const [extensionSystemId, setExtensionSystemId] = useState('');
  const [extensionsRawInput, setExtensionsRawInput] = useState('');

  const [createSystemPayload, setCreateSystemPayload] = useState({
    name: '',
    code: 'RFID_PRESENCE' as HardwareSystemCode,
    hasIdentifiers: true,
    identifiersPerDevice: 5,
    identifierType: 'BADGE' as IdentifierType,
    isActive: true,
  });

  const selectableExtensionSystems = useMemo(
    () => systems.filter((system) => system.hasIdentifiers),
    [systems],
  );

  const refreshSystems = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'systems'] }),
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'catalog'] }),
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'state'] }),
    ]);
  };

  const createSystemMutation = useMutation({
    mutationFn: adminService.createSystem,
    onSuccess: async () => {
      toast.success('Systeme cree.');
      await refreshSystems();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Creation systeme impossible.');
    },
  });

  const updateActivationMutation = useMutation({
    mutationFn: ({ systemId, isActive }: { systemId: string; isActive: boolean }) =>
      adminService.updateSystemActivation(systemId, isActive),
    onSuccess: async () => {
      toast.success('Activation systeme mise a jour.');
      await refreshSystems();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Mise a jour activation impossible.');
    },
  });

  const bulkDevicesMutation = useMutation({
    mutationFn: ({ systemId, devices }: { systemId: string; devices: AdminBulkDeviceItem[] }) =>
      adminService.createDevicesBulk(systemId, {
        quantity: devices.length,
        devices,
      }),
    onSuccess: async (response) => {
      toast.success(`${Number(response.created ?? 0)} boitier(s) provisionne(s).`);
      setDevicesRawInput('');
      await refreshSystems();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Provisionning boitiers impossible.');
    },
  });

  const bulkExtensionsMutation = useMutation({
    mutationFn: ({
      systemId,
      identifiers,
      type,
    }: {
      systemId: string;
      identifiers: string[];
      type?: IdentifierType;
    }) =>
      adminService.createSystemIdentifiersBulk(systemId, {
        type,
        physicalIdentifiers: identifiers,
      }),
    onSuccess: async (response) => {
      toast.success(`${Number(response.created ?? 0)} extension(s) provisionnee(s).`);
      setExtensionsRawInput('');
      await refreshSystems();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Provisionning extensions impossible.');
    },
  });

  const handleCreateSystem = () => {
    if (!createSystemPayload.name.trim()) {
      toast.error('Nom du systeme requis.');
      return;
    }

    createSystemMutation.mutate({
      name: createSystemPayload.name.trim(),
      code: createSystemPayload.code,
      hasIdentifiers: createSystemPayload.hasIdentifiers,
      identifiersPerDevice: createSystemPayload.hasIdentifiers
        ? createSystemPayload.identifiersPerDevice
        : 0,
      identifierType: createSystemPayload.hasIdentifiers
        ? createSystemPayload.identifierType
        : undefined,
      isActive: createSystemPayload.isActive,
    });
  };

  const handleProvisionDevices = () => {
    try {
      const devices = parseDevicesInput(systems, deviceSystemId, devicesRawInput);
      bulkDevicesMutation.mutate({
        systemId: deviceSystemId,
        devices,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Donnees boitiers invalides.');
    }
  };

  const handleProvisionExtensions = () => {
    const targetSystem = systems.find((system) => system.id === extensionSystemId);
    if (!targetSystem) {
      toast.error('Selectionnez un systeme pour les extensions.');
      return;
    }

    const identifiers = parseLines(extensionsRawInput);
    if (identifiers.length === 0) {
      toast.error('Ajoutez au moins un identifiant physique.');
      return;
    }

    bulkExtensionsMutation.mutate({
      systemId: targetSystem.id,
      identifiers,
      type: (targetSystem.identifierType ?? undefined) as IdentifierType | undefined,
    });
  };

  if (!canManageStock) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Admin Stock"
          description="Gestion du stock reel reservee aux roles owner/admin."
        />
        <EmptyState
          title="Acces restreint"
          description="Votre role n est pas autorise a provisionner le stock materiel."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Stock"
        description="Provisioning en amont: boitiers et extensions physiques crees en stock avant tout achat."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {systems.map((system) => (
          <article key={system.id} className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
            <div className="card-body p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">{system.code}</p>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">{system.name}</h2>
                </div>
                <span className={`badge ${system.isActive ? 'badge-success' : 'badge-warning'}`}>
                  {system.isActive ? 'Actif' : 'Inactif'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-[var(--surface-muted)] p-3">
                  <p className="text-xs text-[var(--text-secondary)]">Boitiers</p>
                  <p className="text-xl font-bold text-[var(--text-primary)]">{system.availableDevices}</p>
                </div>
                <div className="rounded-lg bg-[var(--surface-muted)] p-3">
                  <p className="text-xs text-[var(--text-secondary)]">Extensions</p>
                  <p className="text-xl font-bold text-[var(--text-primary)]">{system.availableExtensions}</p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline btn-sm mt-3"
                onClick={() =>
                  updateActivationMutation.mutate({
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

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
          <div className="card-body p-5 space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Provisionner boitiers</h3>

            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">Systeme</span>
              <select
                className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                value={deviceSystemId}
                onChange={(event) => setDeviceSystemId(event.target.value)}
              >
                <option value="">Selectionner</option>
                {systems.map((system) => (
                  <option key={system.id} value={system.id}>
                    {system.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">
                Lignes: `MAC[,ID1,ID2,...]`
              </span>
              <textarea
                className="textarea textarea-bordered mt-1 min-h-36 bg-[var(--surface-muted)]"
                placeholder="AA:70:31:00:00:01,BAD-1001,BAD-1002,BAD-1003,BAD-1004,BAD-1005"
                value={devicesRawInput}
                onChange={(event) => setDevicesRawInput(event.target.value)}
              />
            </label>

            <button
              type="button"
              className="btn btn-info text-[var(--app-bg)]"
              disabled={bulkDevicesMutation.isPending || !deviceSystemId}
              onClick={handleProvisionDevices}
            >
              Valider boitiers en stock
            </button>
          </div>
        </article>

        <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
          <div className="card-body p-5 space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Provisionner extensions</h3>

            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">Systeme</span>
              <select
                className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                value={extensionSystemId}
                onChange={(event) => setExtensionSystemId(event.target.value)}
              >
                <option value="">Selectionner</option>
                {selectableExtensionSystems.map((system) => (
                  <option key={system.id} value={system.id}>
                    {system.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">
                Un identifiant physique par ligne
              </span>
              <textarea
                className="textarea textarea-bordered mt-1 min-h-36 bg-[var(--surface-muted)]"
                placeholder="BAD-3001"
                value={extensionsRawInput}
                onChange={(event) => setExtensionsRawInput(event.target.value)}
              />
            </label>

            <button
              type="button"
              className="btn btn-outline btn-info"
              disabled={bulkExtensionsMutation.isPending || !extensionSystemId}
              onClick={handleProvisionExtensions}
            >
              Valider extensions en stock
            </button>
          </div>
        </article>
      </section>

      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body p-5 space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Creer un systeme</h3>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">Nom</span>
              <input
                className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                value={createSystemPayload.name}
                onChange={(event) =>
                  setCreateSystemPayload((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>

            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">Code</span>
              <select
                className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                value={createSystemPayload.code}
                onChange={(event) =>
                  setCreateSystemPayload((current) => ({
                    ...current,
                    code: event.target.value as HardwareSystemCode,
                  }))
                }
              >
                {SYSTEM_CODE_OPTIONS.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">Type identifiant</span>
              <select
                className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                value={createSystemPayload.identifierType}
                disabled={!createSystemPayload.hasIdentifiers}
                onChange={(event) =>
                  setCreateSystemPayload((current) => ({
                    ...current,
                    identifierType: event.target.value as IdentifierType,
                  }))
                }
              >
                <option value="BADGE">BADGE</option>
                <option value="SERRURE">SERRURE</option>
                <option value="EMPREINTE">EMPREINTE</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">Identifiants / boitier</span>
              <input
                type="number"
                min={0}
                className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                value={createSystemPayload.identifiersPerDevice}
                onChange={(event) =>
                  setCreateSystemPayload((current) => ({
                    ...current,
                    identifiersPerDevice: Math.max(0, Number(event.target.value) || 0),
                  }))
                }
              />
            </label>

            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="toggle toggle-info"
                checked={createSystemPayload.hasIdentifiers}
                onChange={(event) =>
                  setCreateSystemPayload((current) => ({
                    ...current,
                    hasIdentifiers: event.target.checked,
                  }))
                }
              />
              <span className="label-text">Avec identifiants</span>
            </label>

            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="toggle toggle-success"
                checked={createSystemPayload.isActive}
                onChange={(event) =>
                  setCreateSystemPayload((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
              />
              <span className="label-text">Actif</span>
            </label>
          </div>

          <button
            type="button"
            className="btn btn-info text-[var(--app-bg)]"
            disabled={createSystemMutation.isPending}
            onClick={handleCreateSystem}
          >
            Creer le systeme
          </button>
        </div>
      </section>
    </div>
  );
}
