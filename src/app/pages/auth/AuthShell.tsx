import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthShellProps {
  title: string;
  subtitle: string;
  footerText: string;
  footerLinkLabel: string;
  footerLinkTo: string;
  children: ReactNode;
}

export function AuthShell({
  title,
  subtitle,
  footerText,
  footerLinkLabel,
  footerLinkTo,
  children,
}: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--app-bg)] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(0,191,255,0.2),transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(0,230,118,0.12),transparent_40%)]" />

      <div className="relative w-full max-w-xl">
        <div className="card border border-[var(--border-soft)] bg-[var(--card-bg)] shadow-2xl shadow-black/30">
          <div className="card-body gap-6 p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                Systeme de gestion d acces
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{title}</h1>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{subtitle}</p>
            </div>

            {children}

            <p className="text-center text-sm text-[var(--text-secondary)]">
              {footerText}{' '}
              <Link className="link link-info" to={footerLinkTo}>
                {footerLinkLabel}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
