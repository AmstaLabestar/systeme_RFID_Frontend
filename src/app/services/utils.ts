import type { IdentifierType } from '@/app/types';

export const identifierPrefixes: Record<IdentifierType, string> = {
  'badge-rfid': 'BAD',
  empreinte: 'EMP',
  'serrure-rfid': 'SER',
};

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

export function delay(ms = 250): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function formatDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoDate));
}

export function formatCurrencyFcfa(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(value);
}
