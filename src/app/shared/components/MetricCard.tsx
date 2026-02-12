import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  hint: string;
  tone?: 'default' | 'positive' | 'negative';
  icon: LucideIcon;
}

export function MetricCard({ title, value, hint, tone = 'default', icon: Icon }: MetricCardProps) {
  const borderClass =
    tone === 'positive'
      ? 'border-[var(--success-main)]/50'
      : tone === 'negative'
        ? 'border-[var(--error-main)]/50'
        : 'border-[var(--border-soft)]';

  const iconClass =
    tone === 'positive'
      ? 'text-[var(--success-main)] bg-[var(--success-main)]/10'
      : tone === 'negative'
        ? 'text-[var(--error-main)] bg-[var(--error-main)]/10'
        : 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10';

  return (
    <article className={`card border ${borderClass} bg-[var(--card-bg)]`}>
      <div className="card-body gap-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--text-secondary)]">{title}</p>
          <div className={`rounded-xl p-2 ${iconClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-3xl font-bold text-[var(--text-primary)]">{value}</p>
        <p className="text-xs text-[var(--text-secondary)]">{hint}</p>
      </div>
    </article>
  );
}
