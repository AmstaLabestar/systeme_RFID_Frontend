import { randomBytes, randomUUID } from 'crypto';
import {
  createDefaultMarketplaceState,
  createDefaultServicesState,
  DEVICE_COUNTER_SEED,
  IDENTIFIER_COUNTER_SEED,
  IDENTIFIER_PREFIXES,
  MODULE_ACTION_LABELS,
  MODULE_LABELS,
  MODULE_MAC_SEGMENT,
} from './system-state.constants';
import type {
  DeviceUnit,
  Employee,
  FeedbackRecord,
  FeedbackSentiment,
  HistoryEvent,
  IdentifierType,
  InventoryIdentifier,
  MarketplaceStatePayload,
  ModuleKey,
  ServiceAssignment,
  ServicesStatePayload,
} from './system-state.types';

type UnknownRecord = Record<string, unknown>;

const MAC_ADDRESS_REGEX = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return fallback;
}

function asOptionalString(value: unknown): string | undefined {
  const parsed = asString(value).trim();
  return parsed.length > 0 ? parsed : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function toModuleKey(value: unknown): ModuleKey | null {
  const normalized = asString(value).trim().toLowerCase();
  const aliases: Record<string, ModuleKey> = {
    'rfid-presence': 'rfid-presence',
    rfid_presence: 'rfid-presence',
    'rfid-porte': 'rfid-porte',
    rfid_porte: 'rfid-porte',
    biometrie: 'biometrie',
    biometric: 'biometrie',
    feedback: 'feedback',
  };

  return aliases[normalized] ?? null;
}

function toIdentifierType(value: unknown): IdentifierType | null {
  const normalized = asString(value).trim().toLowerCase();
  const aliases: Record<string, IdentifierType> = {
    'badge-rfid': 'badge-rfid',
    badge_rfid: 'badge-rfid',
    empreinte: 'empreinte',
    'serrure-rfid': 'serrure-rfid',
    serrure_rfid: 'serrure-rfid',
  };

  return aliases[normalized] ?? null;
}

function toInventoryStatus(value: unknown): 'available' | 'assigned' {
  return asString(value).trim().toLowerCase() === 'assigned' ? 'assigned' : 'available';
}

function toFeedbackSentiment(value: unknown): FeedbackSentiment {
  const normalized = asString(value).trim().toLowerCase();

  if (normalized === 'negative' || normalized === 'neutral' || normalized === 'positive') {
    return normalized;
  }

  return 'neutral';
}

function toFeedbackSource(value: unknown): 'BUTTON' | 'QR' {
  return asString(value).trim().toUpperCase() === 'QR' ? 'QR' : 'BUTTON';
}

function toDeviceUnit(value: unknown): DeviceUnit | null {
  const source = isRecord(value) ? value : {};
  const id = asOptionalString(source.id);
  const module = toModuleKey(source.module);

  if (!id || !module) {
    return null;
  }

  return {
    id,
    module,
    name: asString(source.name, `Boitier ${id}`),
    location: asString(source.location, 'A configurer'),
    provisionedMacAddress: asString(source.provisionedMacAddress, ''),
    qrToken: asOptionalString(source.qrToken),
    systemIdentifier: asOptionalString(source.systemIdentifier),
    configured: asBoolean(source.configured, false),
    capacity: asNumber(source.capacity, 0),
    createdAt: asString(source.createdAt, new Date().toISOString()),
    activatedAt: asOptionalString(source.activatedAt),
  };
}

function toInventoryIdentifier(value: unknown): InventoryIdentifier | null {
  const source = isRecord(value) ? value : {};
  const id = asOptionalString(source.id);
  const module = toModuleKey(source.module);
  const type = toIdentifierType(source.type);

  if (!id || !module || !type) {
    return null;
  }

  return {
    id,
    module,
    type,
    code: asString(source.code, id.toUpperCase()),
    status: toInventoryStatus(source.status),
    deviceId: asOptionalString(source.deviceId),
    employeeId: asOptionalString(source.employeeId),
    acquiredAt: asString(source.acquiredAt, new Date().toISOString()),
  };
}

function toEmployee(value: unknown): Employee | null {
  const source = isRecord(value) ? value : {};
  const id = asOptionalString(source.id);

  if (!id) {
    return null;
  }

  const firstName = asString(source.firstName);
  const lastName = asString(source.lastName);

  return {
    id,
    firstName,
    lastName,
    fullName: asString(source.fullName, `${firstName} ${lastName}`.trim() || id),
  };
}

function toServiceAssignment(value: unknown): ServiceAssignment | null {
  const source = isRecord(value) ? value : {};
  const id = asOptionalString(source.id);
  const module = toModuleKey(source.module);
  const deviceId = asOptionalString(source.deviceId);
  const identifierId = asOptionalString(source.identifierId);
  const employeeId = asOptionalString(source.employeeId);

  if (!id || !module || !deviceId || !identifierId || !employeeId) {
    return null;
  }

  return {
    id,
    module,
    deviceId,
    identifierId,
    employeeId,
    createdAt: asString(source.createdAt, new Date().toISOString()),
    updatedAt: asString(source.updatedAt, new Date().toISOString()),
  };
}

function toHistoryEvent(value: unknown): HistoryEvent | null {
  const source = isRecord(value) ? value : {};
  const id = asOptionalString(source.id);
  const module = toModuleKey(source.module);
  const deviceId = asOptionalString(source.deviceId);

  if (!id || !module || !deviceId) {
    return null;
  }

  return {
    id,
    module,
    deviceId,
    employee: asString(source.employee, 'Inconnu'),
    identifier: asString(source.identifier, 'N/A'),
    device: asString(source.device, 'Boitier'),
    action: asString(source.action, 'Evenement'),
    occurredAt: asString(source.occurredAt, new Date().toISOString()),
  };
}

function toFeedbackRecord(value: unknown): FeedbackRecord | null {
  const source = isRecord(value) ? value : {};
  const id = asOptionalString(source.id);
  const deviceId = asOptionalString(source.deviceId);

  if (!id || !deviceId) {
    return null;
  }

  return {
    id,
    deviceId,
    module: 'feedback',
    sentiment: toFeedbackSentiment(source.sentiment),
    source: toFeedbackSource(source.source),
    comment: asOptionalString(source.comment),
    createdAt: asString(source.createdAt, new Date().toISOString()),
  };
}

export function normalizeMarketplaceState(value: unknown): MarketplaceStatePayload {
  const fallback = createDefaultMarketplaceState();
  const source = isRecord(value) ? value : {};
  const stockSource = isRecord(source.productStockById) ? source.productStockById : {};
  const productStockById = { ...fallback.productStockById };

  Object.entries(stockSource).forEach(([key, stockValue]) => {
    productStockById[key] = asNullableNumber(stockValue);
  });

  return {
    productStockById,
    devices: asArray(source.devices)
      .map((entry) => toDeviceUnit(entry))
      .filter((entry): entry is DeviceUnit => entry !== null),
    inventory: asArray(source.inventory)
      .map((entry) => toInventoryIdentifier(entry))
      .filter((entry): entry is InventoryIdentifier => entry !== null),
  };
}

export function normalizeServicesState(value: unknown): ServicesStatePayload {
  const fallback = createDefaultServicesState();
  const source = isRecord(value) ? value : {};

  return {
    employees: asArray(source.employees)
      .map((entry) => toEmployee(entry))
      .filter((entry): entry is Employee => entry !== null),
    assignments: asArray(source.assignments)
      .map((entry) => toServiceAssignment(entry))
      .filter((entry): entry is ServiceAssignment => entry !== null),
    history: asArray(source.history)
      .map((entry) => toHistoryEvent(entry))
      .filter((entry): entry is HistoryEvent => entry !== null),
    feedbackRecords: asArray(source.feedbackRecords)
      .map((entry) => toFeedbackRecord(entry))
      .filter((entry): entry is FeedbackRecord => entry !== null),
    ...(!Array.isArray(source.employees) && { employees: fallback.employees }),
    ...(!Array.isArray(source.history) && { history: fallback.history }),
  };
}

export function normalizeDeviceCollection(value: unknown): DeviceUnit[] {
  return asArray(value)
    .map((entry) => toDeviceUnit(entry))
    .filter((entry): entry is DeviceUnit => entry !== null);
}

export function createId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function createQrFeedbackToken(): string {
  return randomBytes(24).toString('hex');
}

export function createUniqueQrFeedbackToken(existingTokens: Set<string>): string {
  let token = createQrFeedbackToken();

  while (existingTokens.has(token)) {
    token = createQrFeedbackToken();
  }

  existingTokens.add(token);
  return token;
}

export function normalizeSystemIdentifier(value: unknown): string {
  return asString(value).trim().toUpperCase().replaceAll('-', ':');
}

export function isValidSystemIdentifier(value: string): boolean {
  return MAC_ADDRESS_REGEX.test(value);
}

function formatHex(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, '0');
}

function parseCodeCounter(code: string, prefix: string): number | null {
  const normalizedPrefix = `${prefix}-`;
  if (!code.startsWith(normalizedPrefix)) {
    return null;
  }

  const suffix = code.slice(normalizedPrefix.length);
  const parsed = Number.parseInt(suffix, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDeviceNameCounter(name: string): number | null {
  const match = name.match(/#(\d+)$/);
  if (!match || !match[1]) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseProvisionedMacSequence(macAddress: string): { module: ModuleKey; sequence: number } | null {
  const normalized = normalizeSystemIdentifier(macAddress);
  const segments = normalized.split(':');

  if (segments.length !== 6) {
    return null;
  }

  const moduleSegment = Number.parseInt(segments[2] || '', 16);
  const high = Number.parseInt(segments[3] || '', 16);
  const low = Number.parseInt(segments[4] || '', 16);

  if (![moduleSegment, high, low].every(Number.isFinite)) {
    return null;
  }

  const moduleEntry = (Object.entries(MODULE_MAC_SEGMENT) as Array<[ModuleKey, number]>).find(
    ([, value]) => value === moduleSegment,
  );

  if (!moduleEntry) {
    return null;
  }

  return {
    module: moduleEntry[0],
    sequence: (high << 8) + low,
  };
}

export function buildProvisionedMacAddress(module: ModuleKey, sequence: number): string {
  const moduleSegment = MODULE_MAC_SEGMENT[module];
  const high = (sequence >> 8) & 0xff;
  const low = sequence & 0xff;

  return ['AA', '70', formatHex(moduleSegment), formatHex(high), formatHex(low), '01'].join(':');
}

export function buildDeviceName(module: ModuleKey, index: number): string {
  return `Boitier ${MODULE_LABELS[module]} #${index}`;
}

export function buildGenerationCounters(state: MarketplaceStatePayload): {
  nextIdentifierCode: (type: IdentifierType) => string;
  nextDeviceIndex: (module: ModuleKey) => number;
  nextProvisionedMacAddress: (module: ModuleKey) => string;
} {
  const identifierCounters = { ...IDENTIFIER_COUNTER_SEED };
  const deviceCounters = { ...DEVICE_COUNTER_SEED };
  const deviceMacCounters = { ...DEVICE_COUNTER_SEED };

  state.inventory.forEach((identifier) => {
    const prefix = IDENTIFIER_PREFIXES[identifier.type];
    const parsed = parseCodeCounter(identifier.code, prefix);

    if (parsed !== null) {
      identifierCounters[identifier.type] = Math.max(identifierCounters[identifier.type], parsed);
    }
  });

  state.devices.forEach((device) => {
    const parsedName = parseDeviceNameCounter(device.name);
    if (parsedName !== null) {
      deviceCounters[device.module] = Math.max(deviceCounters[device.module], parsedName);
    }

    const parsedMac = parseProvisionedMacSequence(device.provisionedMacAddress);
    if (parsedMac) {
      deviceMacCounters[parsedMac.module] = Math.max(deviceMacCounters[parsedMac.module], parsedMac.sequence);
    }
  });

  return {
    nextIdentifierCode(type: IdentifierType): string {
      identifierCounters[type] += 1;
      return `${IDENTIFIER_PREFIXES[type]}-${identifierCounters[type]}`;
    },
    nextDeviceIndex(module: ModuleKey): number {
      deviceCounters[module] += 1;
      return deviceCounters[module];
    },
    nextProvisionedMacAddress(module: ModuleKey): string {
      deviceMacCounters[module] += 1;
      return buildProvisionedMacAddress(module, deviceMacCounters[module]);
    },
  };
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

export function upsertEmployee(
  servicesState: ServicesStatePayload,
  firstName: string,
  lastName: string,
): Employee {
  const normalizedFirstName = normalizeName(firstName);
  const normalizedLastName = normalizeName(lastName);

  const existing = servicesState.employees.find(
    (employee) =>
      normalizeName(employee.firstName) === normalizedFirstName &&
      normalizeName(employee.lastName) === normalizedLastName,
  );

  if (existing) {
    return existing;
  }

  const createdEmployee: Employee = {
    id: createId('emp'),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
  };

  servicesState.employees = [createdEmployee, ...servicesState.employees];
  return createdEmployee;
}

export function appendHistoryEvent(
  servicesState: ServicesStatePayload,
  payload: Omit<HistoryEvent, 'id' | 'occurredAt'>,
): HistoryEvent {
  const event: HistoryEvent = {
    id: createId('hist'),
    occurredAt: new Date().toISOString(),
    ...payload,
  };

  servicesState.history = [event, ...servicesState.history];
  return event;
}

export function toFeedbackSentimentFromPublicValue(value: string): FeedbackSentiment | null {
  const normalized = value.trim().toUpperCase();

  if (normalized === 'NEGATIVE') {
    return 'negative';
  }

  if (normalized === 'NEUTRAL') {
    return 'neutral';
  }

  if (normalized === 'POSITIVE') {
    return 'positive';
  }

  return null;
}

export function getLatestQrFeedbackTimestamp(
  servicesState: ServicesStatePayload,
  deviceId: string,
): number {
  return servicesState.feedbackRecords.reduce((latestTimestamp, entry) => {
    if (entry.deviceId !== deviceId || entry.module !== 'feedback' || entry.source !== 'QR') {
      return latestTimestamp;
    }

    const createdAtTimestamp = new Date(entry.createdAt).getTime();

    if (!Number.isFinite(createdAtTimestamp)) {
      return latestTimestamp;
    }

    return Math.max(latestTimestamp, createdAtTimestamp);
  }, 0);
}

export function getModuleActionLabel(module: ModuleKey, action: 'assign' | 'remove'): string {
  return MODULE_ACTION_LABELS[module]?.[action] || 'Association identifiant';
}
