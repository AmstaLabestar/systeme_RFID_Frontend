import { CheckCircle2, Settings2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { DeviceUnit } from '@/app/types';

interface DeviceSetupFormValues {
  name: string;
  location: string;
}

interface DeviceSetupCardProps {
  device: DeviceUnit;
  onConfigure: (deviceId: string, values: DeviceSetupFormValues) => void;
}

export function DeviceSetupCard({ device, onConfigure }: DeviceSetupCardProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DeviceSetupFormValues>({
    defaultValues: {
      name: device.name,
      location: device.location === 'A configurer' ? '' : device.location,
    },
  });

  return (
    <article className="card border border-[var(--warning-main)]/50 bg-[var(--card-bg)]">
      <div className="card-body gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[var(--warning-main)]/15 p-2 text-[var(--warning-main)]">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">{device.name}</h3>
            <p className="text-xs text-[var(--text-secondary)]">Boitier en attente de configuration</p>
          </div>
        </div>

        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit((values) => onConfigure(device.id, values))}>
          <label className="form-control">
            <span className="label-text text-xs text-[var(--text-secondary)]">Nom du boitier</span>
            <input
              className="input input-bordered mt-1 bg-[var(--surface-muted)]"
              placeholder="Boitier Presence Hall"
              {...register('name', { required: 'Nom requis' })}
            />
            {errors.name ? <span className="mt-1 text-xs text-[var(--error-main)]">{errors.name.message}</span> : null}
          </label>

          <label className="form-control">
            <span className="label-text text-xs text-[var(--text-secondary)]">Localisation</span>
            <input
              className="input input-bordered mt-1 bg-[var(--surface-muted)]"
              placeholder="Reception"
              {...register('location', { required: 'Localisation requise' })}
            />
            {errors.location ? (
              <span className="mt-1 text-xs text-[var(--error-main)]">{errors.location.message}</span>
            ) : null}
          </label>

          <div className="md:col-span-2">
            <button type="submit" className="btn btn-info text-[var(--app-bg)]">
              <CheckCircle2 className="h-4 w-4" />
              Activer le boitier
            </button>
          </div>
        </form>
      </div>
    </article>
  );
}
