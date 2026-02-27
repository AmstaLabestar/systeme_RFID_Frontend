import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
} from 'crypto';

const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;
const ALLOWED_REDIRECT_PREFIX = '/dashboard';
const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const CORRELATION_ID_REGEX = /^[A-Za-z0-9._:-]{8,128}$/;

function decodeCookieComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export interface EncryptedSecretPayload {
  encrypted: string;
  iv: string;
  tag: string;
  hash: string;
}

export function sanitizeString(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, '').replace(/[<>]/g, '').trim();
}

export function readCookieValue(
  rawCookieHeader: string | undefined,
  cookieName: string,
): string | undefined {
  if (!rawCookieHeader || !cookieName) {
    return undefined;
  }

  const encodedName = `${encodeURIComponent(cookieName)}=`;
  const plainName = `${cookieName}=`;
  const cookiePairs = rawCookieHeader.split(';');

  for (const pair of cookiePairs) {
    const trimmedPair = pair.trim();
    if (trimmedPair.startsWith(encodedName)) {
      return decodeCookieComponent(trimmedPair.slice(encodedName.length));
    }
    if (trimmedPair.startsWith(plainName)) {
      return trimmedPair.slice(plainName.length);
    }
  }

  return undefined;
}

export function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeUnknown(entry));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !DANGEROUS_OBJECT_KEYS.has(key))
        .map(([key, entry]) => [key, sanitizeUnknown(entry)]),
    );
  }

  return value;
}

export function normalizeEmail(email: string): string {
  return sanitizeString(email).toLowerCase();
}

export function normalizePhone(phone: string): string {
  return sanitizeString(phone).replace(/\s+/g, '');
}

export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone);
}

export function resolveCorrelationId(candidate?: string): string {
  const normalized = sanitizeString(candidate ?? '').slice(0, 128);
  if (CORRELATION_ID_REGEX.test(normalized)) {
    return normalized;
  }
  return randomUUID();
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createOtpCode(): string {
  return String(randomInt(100_000, 999_999));
}

export function splitName(fullName: string): { firstName: string; lastName: string } {
  const normalized = sanitizeString(fullName);
  const [firstName = '', ...rest] = normalized.split(/\s+/);
  return {
    firstName: firstName || normalized || 'User',
    lastName: rest.join(' ').trim(),
  };
}

export function slugifyDomainPart(value: string): string {
  const safe = sanitizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return safe || 'tenant';
}

export function normalizeDomain(value: string): string {
  const safe = sanitizeString(value).toLowerCase();
  if (safe.includes('.')) {
    return safe;
  }
  return `${slugifyDomainPart(safe)}.local`;
}

export function resolveRedirect(absoluteDashboardUrl: string, requestedPath?: string): string {
  if (!requestedPath) {
    return absoluteDashboardUrl;
  }

  const normalizedPath = sanitizeString(requestedPath);
  if (!normalizedPath.startsWith(ALLOWED_REDIRECT_PREFIX)) {
    return absoluteDashboardUrl;
  }

  // Convert a trusted relative dashboard path to a fully-qualified frontend URL.
  try {
    const dashboardUrl = new URL(absoluteDashboardUrl);
    return new URL(normalizedPath, `${dashboardUrl.protocol}//${dashboardUrl.host}`).toString();
  } catch {
    return absoluteDashboardUrl;
  }
}

function readEncryptionKey(hexKey: string): Buffer {
  const normalized = sanitizeString(hexKey);
  if (!/^[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error('TWO_FACTOR_ENCRYPTION_KEY must be a 64-char hex string.');
  }
  return Buffer.from(normalized, 'hex');
}

export function encryptSecret(secret: string, hexKey: string): EncryptedSecretPayload {
  const key = readEncryptionKey(hexKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    // Hash is kept for tamper detection without exposing the raw secret.
    hash: hashToken(secret),
  };
}

export function decryptSecret(payload: {
  encrypted: string;
  iv: string;
  tag: string;
}, hexKey: string): string {
  const key = readEncryptionKey(hexKey);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(payload.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.encrypted, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
