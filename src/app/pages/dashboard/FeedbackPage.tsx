import { Download, History } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MODULE_LABELS } from '@/app/data';
import { useMarketplace, useServices } from '@/app/contexts';
import { downloadDeviceHistoryPdf, formatDateTime } from '@/app/services';
import type { FeedbackRecord, FeedbackSentiment } from '@/app/types';
import {
  DeviceHistoryDialog,
  DeviceSetupCard,
  EmptyState,
  PageHeader,
  type DeviceHistoryDialogEntry,
} from '@/app/shared/components';

const chartPalette = ['#00BFFF', '#00E676', '#FF9100', '#8E44AD'];

function getFeedbackButtonLabel(sentiment: FeedbackSentiment): string {
  if (sentiment === 'positive') {
    return 'Positif';
  }

  if (sentiment === 'neutral') {
    return 'Neutre';
  }

  return 'Negatif';
}

function mapFeedbackRecordToHistoryEntry(record: FeedbackRecord): DeviceHistoryDialogEntry {
  const buttonLabel = getFeedbackButtonLabel(record.sentiment);

  return {
    id: record.id,
    occurredAt: record.createdAt,
    actor: 'Visiteur',
    identifier: buttonLabel,
    action: `Appui bouton ${buttonLabel.toLowerCase()}`,
  };
}

export function FeedbackPage() {
  const navigate = useNavigate();
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(30);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [historyDeviceId, setHistoryDeviceId] = useState<string | null>(null);

  const { getDevicesByModule, configureDevice } = useMarketplace();
  const { feedbackRecords } = useServices();

  const moduleDevices = getDevicesByModule('feedback', false);
  const configuredDevices = moduleDevices.filter((device) => device.configured);
  const pendingDevices = moduleDevices.filter((device) => !device.configured);

  useEffect(() => {
    if (!configuredDevices.length) {
      setSelectedDeviceId('');
      return;
    }

    if (!configuredDevices.some((device) => device.id === selectedDeviceId)) {
      setSelectedDeviceId(configuredDevices[0].id);
    }
  }, [configuredDevices, selectedDeviceId]);

  useEffect(() => {
    if (!historyDeviceId) {
      return;
    }

    if (!configuredDevices.some((device) => device.id === historyDeviceId)) {
      setHistoryDeviceId(null);
    }
  }, [configuredDevices, historyDeviceId]);

  const getFeedbackHistoryEntries = useCallback(
    (deviceId: string, options?: { periodDays?: number }): DeviceHistoryDialogEntry[] => {
      const minDate = options?.periodDays
        ? new Date(Date.now() - options.periodDays * 24 * 60 * 60 * 1000)
        : null;

      return (
      feedbackRecords
        .filter((record) => record.deviceId === deviceId)
        .filter((record) => (minDate ? new Date(record.createdAt) >= minDate : true))
        .slice()
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .map(mapFeedbackRecordToHistoryEntry)
      );
    },
    [feedbackRecords],
  );

  const historyEntriesByDevice = useMemo(() => {
    const entriesMap = new Map<string, DeviceHistoryDialogEntry[]>();

    configuredDevices.forEach((device) => {
      entriesMap.set(device.id, getFeedbackHistoryEntries(device.id));
    });

    return entriesMap;
  }, [configuredDevices, getFeedbackHistoryEntries]);

  const selectedHistoryDevice = useMemo(
    () => configuredDevices.find((device) => device.id === historyDeviceId) ?? null,
    [configuredDevices, historyDeviceId],
  );

  const selectedDeviceHistory = useMemo<ReadonlyArray<DeviceHistoryDialogEntry>>(
    () => (selectedHistoryDevice ? historyEntriesByDevice.get(selectedHistoryDevice.id) ?? [] : []),
    [selectedHistoryDevice, historyEntriesByDevice],
  );

  const filteredRecords = useMemo(() => {
    if (!selectedDeviceId) {
      return [];
    }

    const minDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    return feedbackRecords.filter(
      (record) => record.deviceId === selectedDeviceId && new Date(record.createdAt) >= minDate,
    );
  }, [feedbackRecords, selectedDeviceId, periodDays]);

  const summary = useMemo(() => {
    return filteredRecords.reduce(
      (accumulator, record) => {
        accumulator.total += 1;
        if (record.sentiment === 'positive') {
          accumulator.positive += 1;
        }
        if (record.sentiment === 'neutral') {
          accumulator.neutral += 1;
        }
        if (record.sentiment === 'negative') {
          accumulator.negative += 1;
        }
        return accumulator;
      },
      { total: 0, positive: 0, neutral: 0, negative: 0 },
    );
  }, [filteredRecords]);

  const satisfactionRate = summary.total > 0 ? ((summary.positive / summary.total) * 100).toFixed(1) : '0.0';

  const barSeries = useMemo(() => {
    const buckets = new Map<string, { day: string; positive: number; neutral: number; negative: number }>();

    filteredRecords.forEach((record) => {
      const date = new Date(record.createdAt);
      const day = new Intl.DateTimeFormat('fr-FR', { month: '2-digit', day: '2-digit' }).format(date);

      if (!buckets.has(day)) {
        buckets.set(day, { day, positive: 0, neutral: 0, negative: 0 });
      }

      const bucket = buckets.get(day)!;
      if (record.sentiment === 'positive') {
        bucket.positive += 1;
      }
      if (record.sentiment === 'neutral') {
        bucket.neutral += 1;
      }
      if (record.sentiment === 'negative') {
        bucket.negative += 1;
      }
    });

    return Array.from(buckets.values()).slice(-15);
  }, [filteredRecords]);

  const pieData = [
    { name: 'Positif', value: summary.positive, color: chartPalette[1] },
    { name: 'Neutre', value: summary.neutral, color: chartPalette[2] },
    { name: 'Negatif', value: summary.negative, color: '#FF5252' },
  ];

  const handleConfigureDevice = async (
    deviceId: string,
    values: { name: string; location: string; systemIdentifier: string },
  ): Promise<boolean> => {
    try {
      await configureDevice(deviceId, values);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Activation impossible.';
      toast.error(message);
      return false;
    }
  };

  const handleDownloadDeviceHistoryPdf = (
    deviceId: string,
    options?: { forceCloseAfterExport?: boolean },
  ) => {
    const device = configuredDevices.find((candidate) => candidate.id === deviceId);

    if (!device) {
      toast.error('Boitier introuvable.');
      return;
    }

    const entries = (historyEntriesByDevice.get(device.id) ?? []).map((entry) => ({
      occurredAt: entry.occurredAt,
      actor: entry.actor,
      identifier: entry.identifier,
      action: entry.action,
    }));

    downloadDeviceHistoryPdf({
      moduleLabel: MODULE_LABELS.feedback,
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

  const handleDownloadSelectedPeriodPdf = () => {
    if (!selectedDeviceId) {
      toast.error('Selectionnez un boitier.');
      return;
    }

    const device = configuredDevices.find((candidate) => candidate.id === selectedDeviceId);

    if (!device) {
      toast.error('Boitier introuvable.');
      return;
    }

    const entries = getFeedbackHistoryEntries(device.id, { periodDays }).map((entry) => ({
      occurredAt: entry.occurredAt,
      actor: entry.actor,
      identifier: entry.identifier,
      action: entry.action,
    }));

    downloadDeviceHistoryPdf({
      moduleLabel: `${MODULE_LABELS.feedback} (${periodDays} jours)`,
      deviceName: device.name,
      deviceId: device.id,
      systemIdentifier: device.systemIdentifier,
      generatedAt: new Date().toISOString(),
      entries,
    });
  };

  if (moduleDevices.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Feedback"
          description="Module statistique uniquement: boitiers a 3 boutons (negatif, neutre, positif)."
        />
        <EmptyState
          title="Aucun boitier Feedback"
          description="Achetez votre boitier dans le Marketplace pour lancer la collecte des retours."
          action={
            <button type="button" className="btn btn-info text-[var(--app-bg)]" onClick={() => navigate('/dashboard/marketplace')}>
              Aller au Marketplace
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback"
        description="Statistiques des boutons Negatif / Neutre / Positif. Aucun CRUD sur ce module."
      />

      {pendingDevices.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm uppercase tracking-[0.2em] text-[var(--warning-main)]">Activation des boitiers</h2>
          <div className="grid gap-4">
            {pendingDevices.map((device) => (
              <DeviceSetupCard key={device.id} device={device} onConfigure={handleConfigureDevice} />
            ))}
          </div>
        </section>
      )}

      {configuredDevices.length === 0 ? (
        <EmptyState
          title="Activation requise"
          description="Le module feedback devient exploitable apres activation MAC d au moins un boitier."
        />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {configuredDevices.map((device) => {
              const deviceHistory = historyEntriesByDevice.get(device.id) ?? [];
              const latestEvent = deviceHistory[0];

              return (
                <article key={device.id} className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
                  <div className="card-body p-5">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">{device.name}</h3>
                    <p className="text-xs text-[var(--text-secondary)]">{device.location}</p>
                    <p className="mt-1 font-mono text-xs text-[var(--accent-primary)]">
                      MAC: {device.systemIdentifier ?? 'N/A'}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-center text-xs">
                      <div className="rounded-lg bg-[var(--surface-muted)] p-3">
                        <p className="text-[var(--text-secondary)]">Evenements</p>
                        <p className="text-lg font-bold text-[var(--text-primary)]">{deviceHistory.length}</p>
                      </div>
                      <div className="rounded-lg bg-[var(--surface-muted)] p-3">
                        <p className="text-[var(--text-secondary)]">Dernier event</p>
                        <p className="text-sm font-semibold text-[var(--accent-primary)]">
                          {latestEvent ? formatDateTime(latestEvent.occurredAt) : 'Aucun'}
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
                        Historique
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

          <section className="flex flex-wrap items-center gap-3">
            <label className="form-control w-full max-w-xs">
              <span className="label-text text-xs text-[var(--text-secondary)]">Boitier</span>
              <select
                className="select select-bordered mt-1 bg-[var(--surface-muted)]"
                value={selectedDeviceId}
                onChange={(event) => setSelectedDeviceId(event.target.value)}
              >
                {configuredDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="join">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  className={`join-item btn ${periodDays === days ? 'btn-info text-[var(--app-bg)]' : 'btn-outline btn-info'}`}
                  onClick={() => setPeriodDays(days as 7 | 30 | 90)}
                >
                  {days} jours
                </button>
              ))}
            </div>

            <button type="button" className="btn btn-outline btn-info" onClick={handleDownloadSelectedPeriodPdf}>
              <Download className="h-4 w-4" />
              PDF {periodDays} jours
            </button>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
              <div className="card-body p-4">
                <p className="text-sm text-[var(--text-secondary)]">Total retours</p>
                <p className="text-3xl font-bold text-[var(--text-primary)]">{summary.total}</p>
              </div>
            </article>
            <article className="card border border-[var(--success-main)]/40 bg-[var(--success-main)]/10">
              <div className="card-body p-4">
                <p className="text-sm text-[var(--text-secondary)]">Positifs</p>
                <p className="text-3xl font-bold text-[var(--success-main)]">{summary.positive}</p>
              </div>
            </article>
            <article className="card border border-[var(--warning-main)]/40 bg-[var(--warning-main)]/10">
              <div className="card-body p-4">
                <p className="text-sm text-[var(--text-secondary)]">Neutres</p>
                <p className="text-3xl font-bold text-[var(--warning-main)]">{summary.neutral}</p>
              </div>
            </article>
            <article className="card border border-[var(--error-main)]/40 bg-[var(--error-main)]/10">
              <div className="card-body p-4">
                <p className="text-sm text-[var(--text-secondary)]">Negatifs</p>
                <p className="text-3xl font-bold text-[var(--error-main)]">{summary.negative}</p>
                <p className="text-xs text-[var(--text-secondary)]">Satisfaction: {satisfactionRate}%</p>
              </div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
              <div className="card-body p-5">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Evolution journaliere</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,146,176,0.2)" />
                      <XAxis dataKey="day" stroke="#8892B0" />
                      <YAxis stroke="#8892B0" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="positive" stackId="a" fill={chartPalette[1]} name="Positif" />
                      <Bar dataKey="neutral" stackId="a" fill={chartPalette[2]} name="Neutre" />
                      <Bar dataKey="negative" stackId="a" fill="#FF5252" name="Negatif" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </article>

            <article className="card border border-[var(--border-soft)] bg-[var(--card-bg)]">
              <div className="card-body p-5">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Repartition</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110} label>
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </article>
          </section>
        </>
      )}

      {selectedHistoryDevice ? (
        <DeviceHistoryDialog
          moduleLabel={MODULE_LABELS.feedback}
          deviceName={selectedHistoryDevice.name}
          deviceId={selectedHistoryDevice.id}
          systemIdentifier={selectedHistoryDevice.systemIdentifier}
          identifierLabel="Bouton"
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
