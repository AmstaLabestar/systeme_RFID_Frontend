import { useMemo, useState } from 'react';
import { MODULE_LABELS } from '@/app/data';
import { useServices } from '@/app/contexts';
import { formatDateTime } from '@/app/services';
import type { ModuleKey } from '@/app/types';
import { PageHeader } from '@/app/shared/components';

export function HistoriquePage() {
  const { history } = useServices();
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
      <PageHeader
        title="Historique global"
        description="Traçabilite transverse des evenements: employee, identifiant, boitier, date et action."
      />

      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body gap-4 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">Module</span>
              <select
                className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value as 'all' | ModuleKey)}
              >
                <option value="all">Tous les modules</option>
                {Object.entries(MODULE_LABELS).map(([module, label]) => (
                  <option key={module} value={module}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control md:col-span-2">
              <span className="label-text text-xs text-[var(--text-secondary)]">Recherche</span>
              <input
                className="input input-bordered mt-1 bg-[var(--surface-muted)]"
                placeholder="Employee, identifiant, boitier..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date / Heure</th>
                  <th>Module</th>
                  <th>Employee</th>
                  <th>Identifiant</th>
                  <th>Boitier</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-sm text-[var(--text-secondary)]">
                      Aucun evenement sur ces filtres.
                    </td>
                  </tr>
                )}
                {filteredHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.occurredAt)}</td>
                    <td>{MODULE_LABELS[entry.module]}</td>
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
