import { useMemo, useState } from 'react';
import { MODULE_LABEL_KEYS } from '@/app/data';
import { useI18n, useServices } from '@/app/contexts';
import { formatDateTime } from '@/app/services';
import type { ModuleKey } from '@/app/types';
import { PageHeader } from '@/app/shared/components';

export function HistoriquePage() {
  const { history } = useServices();
  const { locale, t } = useI18n();
  const [moduleFilter, setModuleFilter] = useState<'all' | ModuleKey>('all');
  const [search, setSearch] = useState('');

  const filteredHistory = useMemo(() => {
    return history.filter((entry) => {
      if (moduleFilter !== 'all' && entry.module !== moduleFilter) {
        return false;
      }

      if (!search.trim()) {
        return true;
      }

      const normalizedSearch = search.toLowerCase();
      return (
        entry.employee.toLowerCase().includes(normalizedSearch) ||
        entry.identifier.toLowerCase().includes(normalizedSearch) ||
        entry.device.toLowerCase().includes(normalizedSearch) ||
        entry.action.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [history, moduleFilter, search]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('history.title')} description={t('history.description')} />

      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body gap-4 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">{t('history.filters.module')}</span>
              <select
                className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value as 'all' | ModuleKey)}
              >
                <option value="all">{t('history.filters.allModules')}</option>
                {Object.entries(MODULE_LABEL_KEYS).map(([module, labelKey]) => (
                  <option key={module} value={module}>
                    {t(labelKey)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control md:col-span-2">
              <span className="label-text text-xs text-[var(--text-secondary)]">{t('history.filters.search')}</span>
              <input
                className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                placeholder={t('history.filters.searchPlaceholder')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('table.dateTime')}</th>
                  <th>{t('table.module')}</th>
                  <th>{t('table.employee')}</th>
                  <th>{t('table.identifier')}</th>
                  <th>{t('table.device')}</th>
                  <th>{t('table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-sm text-[var(--text-secondary)]">
                      {t('history.none')}
                    </td>
                  </tr>
                )}
                {filteredHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.occurredAt, locale === 'fr' ? 'fr-FR' : 'en-US')}</td>
                    <td>{t(MODULE_LABEL_KEYS[entry.module])}</td>
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
    </div>
  );
}
