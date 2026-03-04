import readXlsxFile from 'read-excel-file/browser';
import type {
  AdminBulkDeviceItem,
  HardwareSystemCode,
  IdentifierType,
  OutboxEventType,
} from '@/app/services';

export const SYSTEM_CODE_OPTIONS: HardwareSystemCode[] = [
  'RFID_PRESENCE',
  'RFID_PORTE',
  'BIOMETRIE',
  'FEEDBACK',
];

export const WEBHOOK_EVENT_OPTIONS: OutboxEventType[] = [
  'ORDER_ALLOCATED',
  'STOCK_LOW',
  'DEVICE_ACTIVATED',
  'RESERVATION_RELEASED',
];

export const DEFAULT_SYSTEM_PRICING: Record<
  HardwareSystemCode,
  { deviceUnitPriceCents: number; extensionUnitPriceCents: number; currency: string }
> = {
  RFID_PRESENCE: { deviceUnitPriceCents: 21000, extensionUnitPriceCents: 1000, currency: 'XOF' },
  RFID_PORTE: { deviceUnitPriceCents: 20000, extensionUnitPriceCents: 1000, currency: 'XOF' },
  BIOMETRIE: { deviceUnitPriceCents: 20000, extensionUnitPriceCents: 1000, currency: 'XOF' },
  FEEDBACK: { deviceUnitPriceCents: 15000, extensionUnitPriceCents: 0, currency: 'XOF' },
};

export type ProvisionMode = 'manual' | 'csv';

export const SYSTEM_IDENTIFIER_TYPE_MAP: Record<
  Exclude<HardwareSystemCode, 'FEEDBACK'>,
  IdentifierType
> = {
  RFID_PRESENCE: 'BADGE',
  RFID_PORTE: 'SERRURE',
  BIOMETRIE: 'EMPREINTE',
};

export interface SystemPricingDraft {
  deviceUnitPriceCents: string;
  extensionUnitPriceCents: string;
  currency: string;
}

export const MAC_ADDRESS_REGEX = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
export const GENERIC_IDENTIFIER_REGEX = /^[A-Z0-9][A-Z0-9:_-]{1,119}$/;

export function normalizeSpreadsheetCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).trim();
}

export async function parseXlsxRows(file: File): Promise<string[][]> {
  const rows = await readXlsxFile(file);
  return rows
    .map((row) =>
      row
        .map((entry) => normalizeSpreadsheetCell(entry))
        .filter((entry) => entry.length > 0),
    )
    .filter((row) => row.length > 0);
}

export function parseRows(text: string): AdminBulkDeviceItem[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line
        .split(/[;,]/)
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      const [macAddress, ...identifiers] = parts;
      const normalizedIdentifiers = identifiers
        .map((identifier) => normalizePhysicalIdentifierInput(identifier))
        .filter((identifier) => identifier.length > 0);
      return {
        macAddress: normalizeMacInput(macAddress ?? ''),
        identifiers: normalizedIdentifiers.length > 0 ? normalizedIdentifiers : undefined,
      };
    });
}

export function parseExtensionRows(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line
        .split(/[;,]/)
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      return normalizePhysicalIdentifierInput(parts[0] ?? '');
    })
    .filter((identifier) => identifier.length > 0);
}

export function normalizeMacInput(value: string): string {
  return value.trim().toUpperCase().replace(/-/g, ':');
}

export function normalizePhysicalIdentifierInput(value: string): string {
  const normalized = value.trim().toUpperCase();
  const normalizedAsMac = normalized.replace(/-/g, ':');
  if (MAC_ADDRESS_REGEX.test(normalizedAsMac)) {
    return normalizedAsMac;
  }
  return normalized;
}

export function isValidPhysicalIdentifier(value: string): boolean {
  return MAC_ADDRESS_REGEX.test(value) || GENERIC_IDENTIFIER_REGEX.test(value);
}

export function formatDateTime(value?: string): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function formatAuditDetails(details: unknown): string | null {
  if (details === null || details === undefined) {
    return null;
  }
  try {
    const serialized = JSON.stringify(details);
    return serialized.length > 160 ? `${serialized.slice(0, 157)}...` : serialized;
  } catch {
    return String(details);
  }
}

export function formatMoneyFromCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cents);
  } catch {
    return `${cents} ${currency}`;
  }
}
