import { useMemo, useState } from 'react';
import { MODULE_LABEL_KEYS } from '@/app/data';
import { useI18n, useServices } from '@/app/contexts';
import { formatDateTime } from '@/app/services';
import type { HistoryEvent, ModuleKey } from '@/app/types';
import { PageHeader } from '@/app/shared/components';

type ScanFilter =
  | 'all'
  | 'presence_scans'
  | 'presence_scans_attributed'
  | 'presence_scans_unattributed';
type SortMode = 'recent' | 'unattributed_first';

function getScanAttributionStatus(entry: HistoryEvent): 'attributed' | 'unattributed' | 'unknown' {
  if (entry.eventType !== 'identifier_scanned') {
    return 'unknown';
  }

  const metadata = entry.metadata;
  const attributedFromMetadata = metadata?.attributed;
  if (typeof attributedFromMetadata === 'boolean') {
    return attributedFromMetadata ? 'attributed' : 'unattributed';
  }

  const assignmentId = metadata?.assignmentId;
  if (typeof assignmentId === 'string') {
    return assignmentId.trim().length > 0 ? 'attributed' : 'unattributed';
  }
  if (assignmentId === null) {
    return 'unattributed';
  }

  const normalizedAction = entry.action.toLowerCase();
  if (normalizedAction.includes('non attribue') || normalizedAction.includes('unattributed')) {
    return 'unattributed';
  }

  return 'unknown';
}

export function HistoriquePage() {
  const { history } = useServices();
  const { locale, t } = useI18n();
  const [moduleFilter, setModuleFilter] = useState<'all' | ModuleKey>('all');
  const [scanFilter, setScanFilter] = useState<ScanFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [search, setSearch] = useState('');

  const filteredHistory = useMemo(() => {
    return history.filter((entry) => {
      if (moduleFilter !== 'all' && entry.module !== moduleFilter) {
        return false;
      }

      if (scanFilter === 'presence_scans' && entry.eventType !== 'identifier_scanned') {
        return false;
      }

      if (scanFilter === 'presence_scans_attributed') {
        return getScanAttributionStatus(entry) === 'attributed';
      }

      if (scanFilter === 'presence_scans_unattributed') {
        return getScanAttributionStatus(entry) === 'unattributed';
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
  }, [history, moduleFilter, scanFilter, search]);

  const summary = useMemo(() => {
    let presenceScans = 0;
    let attributedScans = 0;
    let unattributedScans = 0;
    let unknownScans = 0;

    filteredHistory.forEach((entry) => {
      if (entry.eventType !== 'identifier_scanned') {
        return;
      }

      presenceScans += 1;
      const status = getScanAttributionStatus(entry);
      if (status === 'attributed') {
        attributedScans += 1;
        return;
      }
      if (status === 'unattributed') {
        unattributedScans += 1;
        return;
      }
      unknownScans += 1;
    });

    return {
      totalEvents: filteredHistory.length,
      presenceScans,
      attributedScans,
      unattributedScans,
      unknownScans,
    };
  }, [filteredHistory]);

  const sortedHistory = useMemo(() => {
    const byRecent = (left: HistoryEvent, right: HistoryEvent): number => {
      const leftDate = Date.parse(left.occurredAt);
      const rightDate = Date.parse(right.occurredAt);
      if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
        if (rightDate !== leftDate) {
          return rightDate - leftDate;
        }
      }
      return right.id.localeCompare(left.id);
    };

    if (sortMode === 'recent') {
      return [...filteredHistory].sort(byRecent);
    }

    const priority = (entry: HistoryEvent): number => {
      if (entry.eventType !== 'identifier_scanned') {
        return 3;
      }

      const status = getScanAttributionStatus(entry);
      if (status === 'unattributed') {
        return 0;
      }
      if (status === 'attributed') {
        return 1;
      }
      return 2;
    };

    return [...filteredHistory].sort((left, right) => {
      const leftPriority = priority(left);
      const rightPriority = priority(right);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return byRecent(left, right);
    });
  }, [filteredHistory, sortMode]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('history.title')} description={t('history.description')} />

      <section className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
        <div className="card-body gap-4 p-5">
          <div className="grid gap-4 md:grid-cols-5">
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

            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">
                {t('history.filters.scanType')}
              </span>
              <select
                className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                value={scanFilter}
                onChange={(event) => setScanFilter(event.target.value as ScanFilter)}
              >
                <option value="all">{t('history.filters.scanType.all')}</option>
                <option value="presence_scans">{t('history.filters.scanType.presenceAll')}</option>
                <option value="presence_scans_attributed">
                  {t('history.filters.scanType.attributed')}
                </option>
                <option value="presence_scans_unattributed">
                  {t('history.filters.scanType.unattributed')}
                </option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs text-[var(--text-secondary)]">{t('history.filters.sort')}</span>
              <select
                className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
              >
                <option value="recent">{t('history.filters.sort.recent')}</option>
                <option value="unattributed_first">
                  {t('history.filters.sort.unattributedFirst')}
                </option>
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

          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-outline">
              {t('history.summary.total', { count: summary.totalEvents })}
            </span>
            <span className="badge badge-info badge-outline">
              {t('history.summary.presenceScans', { count: summary.presenceScans })}
            </span>
            <span className="badge badge-success">
              {t('history.summary.attributed', { count: summary.attributedScans })}
            </span>
            <span className="badge badge-warning">
              {t('history.summary.unattributed', { count: summary.unattributedScans })}
            </span>
            {summary.unknownScans > 0 ? (
              <span className="badge badge-outline">
                {t('history.summary.unknown', { count: summary.unknownScans })}
              </span>
            ) : null}
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
                {sortedHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-sm text-[var(--text-secondary)]">
                      {t('history.none')}
                    </td>
                  </tr>
                )}
                {sortedHistory.map((entry) => {
                  const scanStatus = getScanAttributionStatus(entry);
                  const scanStatusClass =
                    scanStatus === 'attributed'
                      ? 'badge-success'
                      : scanStatus === 'unattributed'
                        ? 'badge-warning'
                        : 'badge-outline';

                  return (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.occurredAt, locale === 'fr' ? 'fr-FR' : 'en-US')}</td>
                      <td>{t(MODULE_LABEL_KEYS[entry.module])}</td>
                      <td>{entry.employee}</td>
                      <td className="font-mono text-[var(--accent-primary)]">{entry.identifier}</td>
                      <td>{entry.device}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          {entry.eventType === 'identifier_scanned' ? (
                            <span className={`badge badge-xs ${scanStatusClass}`}>
                              {scanStatus === 'attributed'
                                ? t('history.scanStatus.attributed')
                                : scanStatus === 'unattributed'
                                  ? t('history.scanStatus.unattributed')
                                  : t('history.scanStatus.unknown')}
                            </span>
                          ) : null}
                          <span>{entry.action}</span>
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
    </div>
  );
}
