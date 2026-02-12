import { useEffect, useMemo, useState } from 'react';
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
import { useMarketplace, useServices } from '@/app/contexts';
import { DeviceSetupCard, EmptyState, PageHeader } from '@/app/shared/components';

const chartPalette = ['#00BFFF', '#00E676', '#FF9100', '#8E44AD'];

export function FeedbackPage() {
  const navigate = useNavigate();
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(30);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

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
          <h2 className="text-sm uppercase tracking-[0.2em] text-[var(--warning-main)]">Configuration des boitiers</h2>
          <div className="grid gap-4">
            {pendingDevices.map((device) => (
              <DeviceSetupCard key={device.id} device={device} onConfigure={configureDevice} />
            ))}
          </div>
        </section>
      )}

      {configuredDevices.length === 0 ? (
        <EmptyState
          title="Configuration requise"
          description="Le module feedback apparait dans le dashboard apres activation d au moins un boitier."
        />
      ) : (
        <>
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
    </div>
  );
}
