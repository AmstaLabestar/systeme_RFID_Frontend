import { ShoppingBag } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="card border border-dashed border-[var(--border-soft)] bg-[var(--surface-muted)]/60">
      <div className="card-body items-center text-center">
        <div className="rounded-2xl bg-[var(--accent-primary)]/15 p-4 text-[var(--accent-primary)]">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="max-w-xl text-sm text-[var(--text-secondary)]">{description}</p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
