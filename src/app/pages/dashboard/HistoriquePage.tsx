import { ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
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

function getOptionalMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function getDebugCopyPayload(entry: HistoryEvent): string | null {
  if (entry.eventType !== 'identifier_scanned') {
    return null;
  }

  const lines = [`historyEventId=${entry.id}`];
  const ingestionEventId = getOptionalMetadataString(entry.metadata, 'ingestionEventId');
  const ingestionInboxId = getOptionalMetadataString(entry.metadata, 'ingestionInboxId');
  const streamEventId = getOptionalMetadataString(entry.metadata, 'streamEventId');
  const sourceSequence = getOptionalMetadataString(entry.metadata, 'sourceSequence');

  if (ingestionEventId) {
    lines.push(`ingestionEventId=${ingestionEventId}`);
  }
  if (ingestionInboxId) {
    lines.push(`ingestionInboxId=${ingestionInboxId}`);
  }
  if (streamEventId) {
    lines.push(`streamEventId=${streamEventId}`);
  }
  if (sourceSequence) {
    lines.push(`sourceSequence=${sourceSequence}`);
  }

  return lines.join('\n');
}

function getDebugDetails(entry: HistoryEvent): Array<{ labelKey: string; value: string }> {
  const details: Array<{ labelKey: string; value: string }> = [
    {
      labelKey: 'history.debugPanel.historyEventId',
      value: entry.id,
    },
  ];

  const ingestionEventId = getOptionalMetadataString(entry.metadata, 'ingestionEventId');
  const ingestionInboxId = getOptionalMetadataString(entry.metadata, 'ingestionInboxId');
  const streamEventId = getOptionalMetadataString(entry.metadata, 'streamEventId');
  const sourceSequence = getOptionalMetadataString(entry.metadata, 'sourceSequence');

  if (ingestionEventId) {
    details.push({
      labelKey: 'history.debugPanel.ingestionEventId',
      value: ingestionEventId,
    });
  }
  if (ingestionInboxId) {
    details.push({
      labelKey: 'history.debugPanel.ingestionInboxId',
      value: ingestionInboxId,
    });
  }
  if (streamEventId) {
    details.push({
      labelKey: 'history.debugPanel.streamEventId',
      value: streamEventId,
    });
  }
  if (sourceSequence) {
    details.push({
      labelKey: 'history.debugPanel.sourceSequence',
      value: sourceSequence,
    });
  }

  return details;
}

export function HistoriquePage() {
  const { history } = useServices();
  const { locale, t } = useI18n();
  const [moduleFilter, setModuleFilter] = useState<'all' | ModuleKey>('all');
  const [scanFilter, setScanFilter] = useState<ScanFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [expandedDebugEventId, setExpandedDebugEventId] = useState<string | null>(null);
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

  const handleCopyDebugIds = async (entry: HistoryEvent) => {
    const payload = getDebugCopyPayload(entry);
    if (!payload) {
      toast.error(t('history.debugIds.unavailable'));
      return;
    }

    if (!navigator.clipboard?.writeText) {
      toast.error(t('history.debugIds.clipboardUnavailable'));
      return;
    }

    try {
      await navigator.clipboard.writeText(payload);
      toast.success(t('history.debugIds.copied'));
    } catch {
      toast.error(t('history.debugIds.copyError'));
    }
  };

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
                  const isScanEvent = entry.eventType === 'identifier_scanned';
                  const isDebugExpanded = expandedDebugEventId === entry.id;
                  const debugDetails = isScanEvent ? getDebugDetails(entry) : [];

                  return (
                    <Fragment key={entry.id}>
                      <tr>
                        <td>{formatDateTime(entry.occurredAt, locale === 'fr' ? 'fr-FR' : 'en-US')}</td>
                        <td>{t(MODULE_LABEL_KEYS[entry.module])}</td>
                        <td>{entry.employee}</td>
                        <td className="font-mono text-[var(--accent-primary)]">{entry.identifier}</td>
                        <td>{entry.device}</td>
                        <td>
                          <div className="flex flex-wrap items-center gap-2">
                            {isScanEvent ? (
                              <span className={`badge badge-xs ${scanStatusClass}`}>
                                {scanStatus === 'attributed'
                                  ? t('history.scanStatus.attributed')
                                  : scanStatus === 'unattributed'
                                    ? t('history.scanStatus.unattributed')
                                    : t('history.scanStatus.unknown')}
                              </span>
                            ) : null}
                            <span>{entry.action}</span>
                            {isScanEvent ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                title={t('history.debugPanel.toggle')}
                                aria-label={t('history.debugPanel.toggle')}
                                onClick={() => {
                                  setExpandedDebugEventId((current) => (current === entry.id ? null : entry.id));
                                }}
                              >
                                {isDebugExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                {t('history.debugPanel.label')}
                              </button>
                            ) : null}
                            {isScanEvent ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                title={t('history.debugIds.copyButton')}
                                aria-label={t('history.debugIds.copyButton')}
                                onClick={() => {
                                  void handleCopyDebugIds(entry);
                                }}
                              >
                                <Copy className="h-3 w-3" />
                                {t('history.debugIds.label')}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {isScanEvent && isDebugExpanded ? (
                        <tr>
                          <td colSpan={6} className="bg-[var(--surface-muted)]/50">
                            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
                              <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-secondary)]">
                                {t('history.debugPanel.title')}
                              </p>
                              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                {debugDetails.map((detail) => (
                                  <div
                                    key={`${entry.id}:${detail.labelKey}`}
                                    className="rounded-lg border border-[var(--border-soft)] bg-[var(--card-bg)] p-3"
                                  >
                                    <p className="text-xs text-[var(--text-secondary)]">{t(detail.labelKey)}</p>
                                    <p className="mt-1 break-all font-mono text-xs text-[var(--text-primary)]">
                                      {detail.value}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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
