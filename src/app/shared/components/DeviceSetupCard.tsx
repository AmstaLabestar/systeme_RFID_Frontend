import { CheckCircle2, Link2, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useI18n } from '@/app/contexts';
import type { DeviceConfigurationInput, DeviceUnit } from '@/app/types';

interface DeviceSetupFormValues extends DeviceConfigurationInput {}

interface DeviceSetupCardProps {
  device: DeviceUnit;
  onConfigure: (deviceId: string, values: DeviceSetupFormValues) => Promise<boolean | void> | boolean | void;
}

const MAC_INPUT_REGEX = /^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/;

function normalizeMacAddress(value: string): string {
  return value.trim().toUpperCase().replace(/-/g, ':');
}

export function DeviceSetupCard({ device, onConfigure }: DeviceSetupCardProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<DeviceSetupFormValues>({
    defaultValues: {
      name: '',
      location: device.location === 'A configurer' ? '' : device.location,
      systemIdentifier: device.provisionedMacAddress,
    },
  });

  const onSubmit = async (values: DeviceSetupFormValues) => {
    const result = await onConfigure(device.id, values);

    if (result !== false) {
      setIsOpen(false);
      reset(values);
    }
  };

  return (
    <>
      <article className="card border border-[var(--warning-main)]/50 bg-[var(--card-bg)]">
        <div className="card-body gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[var(--warning-main)]/15 p-2 text-[var(--warning-main)]">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">{device.name}</h3>
                <p className="text-xs text-[var(--text-secondary)]">{t('deviceSetup.inactiveHint')}</p>
              </div>
            </div>

            <button type="button" className="btn btn-info text-[var(--app-bg)]" onClick={() => setIsOpen(true)}>
              <Link2 className="h-4 w-4" />
              {t('deviceSetup.activate')}
            </button>
          </div>

          <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-secondary)]">
            <p>
              {t('deviceSetup.deliveredMac')}{' '}
              <span className="font-mono text-[var(--text-primary)]">{device.provisionedMacAddress}</span>
            </p>
            <p className="mt-1">
              {t('deviceSetup.deviceId')}{' '}
              <span className="font-mono text-[var(--text-primary)]">{device.id}</span>
            </p>
          </div>
        </div>
      </article>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] shadow-2xl">
            <div className="card-body gap-5">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('deviceSetup.dialog.title')}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{t('deviceSetup.dialog.description')}</p>
              </div>

              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">
                    {t('deviceSetup.form.deviceName')} (optionnel)
                  </span>
                  <input
                    className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                    placeholder={t('deviceSetup.form.deviceNamePlaceholder')}
                    {...register('name', {
                      validate: (value) =>
                        !value || value.trim().length >= 2 || t('deviceSetup.form.deviceNameRequired'),
                    })}
                  />
                  {errors.name ? (
                    <span className="mt-1 text-xs text-[var(--error-main)]">{errors.name.message}</span>
                  ) : null}
                </label>

                <label className="form-control">
                  <span className="label-text text-xs text-[var(--text-secondary)]">
                    {t('deviceSetup.form.location')}
                  </span>
                  <input
                    className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                    placeholder={t('deviceSetup.form.locationPlaceholder')}
                    {...register('location', { required: t('deviceSetup.form.locationRequired') })}
                  />
                  {errors.location ? (
                    <span className="mt-1 text-xs text-[var(--error-main)]">{errors.location.message}</span>
                  ) : null}
                </label>

                <label className="form-control md:col-span-2">
                  <span className="label-text text-xs text-[var(--text-secondary)]">
                    {t('deviceSetup.form.macLabel')}
                  </span>
                  <input
                    className="input input-bordered mt-1 bg-[var(--surface-muted)] font-mono uppercase"
                    placeholder="AA:BB:CC:DD:EE:FF"
                    {...register('systemIdentifier', {
                      required: t('deviceSetup.form.systemIdentifierRequired'),
                      validate: (value) => {
                        const normalized = normalizeMacAddress(value);
                        return (
                          MAC_INPUT_REGEX.test(normalized) &&
                          normalized === device.provisionedMacAddress
                        ) || t('deviceSetup.form.macMustMatch');
                      },
                    })}
                  />
                  {errors.systemIdentifier ? (
                    <span className="mt-1 text-xs text-[var(--error-main)]">
                      {errors.systemIdentifier.message}
                    </span>
                  ) : (
                    <span className="mt-1 text-xs text-[var(--text-secondary)]">
                      {t('deviceSetup.form.macExactHint')}
                    </span>
                  )}
                </label>

                <div className="flex items-center gap-2 md:col-span-2">
                  <button type="submit" className="btn btn-info text-[var(--app-bg)]" disabled={isSubmitting}>
                    <CheckCircle2 className="h-4 w-4" />
                    {isSubmitting ? t('deviceSetup.form.activating') : t('deviceSetup.form.confirmActivation')}
                  </button>

                  <button type="button" className="btn btn-ghost" onClick={() => setIsOpen(false)}>
                    {t('common.close')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
