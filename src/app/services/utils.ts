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

export function formatDateTime(isoDate: string, locale = 'fr-FR'): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoDate));
}

export function formatCurrencyMinor(valueMinor: number, currency = 'XOF'): string {
  const formatter = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
  const divisor = 10 ** fractionDigits;
  return formatter.format(valueMinor / divisor);
}
