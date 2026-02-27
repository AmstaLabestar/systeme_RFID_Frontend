import {
  decryptSecret,
  encryptSecret,
  readCookieValue,
  resolveCorrelationId,
  resolveRedirect,
  sanitizeString,
  sanitizeUnknown,
} from './security.util';

describe('security.util', () => {
  it('sanitizes control chars and html brackets', () => {
    const sanitized = sanitizeString('  <admin>\u0000ok\u001f  ');
    expect(sanitized).toBe('adminok');
  });

  it('reads plain and encoded cookie values', () => {
    const header = 'foo=bar; rfid.csrf_token=abc123; encoded=value%20with%20space';
    expect(readCookieValue(header, 'rfid.csrf_token')).toBe('abc123');
    expect(readCookieValue(header, 'encoded')).toBe('value with space');
  });

  it('removes dangerous keys while sanitizing nested unknown input', () => {
    const input = JSON.parse(
      '{"safe":"ok","nested":{"child":"<x>"},"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"poisoned":"yes"}}}',
    ) as Record<string, unknown>;

    const sanitized = sanitizeUnknown(input) as Record<string, unknown>;
    expect(sanitized.safe).toBe('ok');
    expect((sanitized.nested as Record<string, unknown>).child).toBe('x');
    expect(Object.prototype.hasOwnProperty.call(sanitized, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(sanitized, 'constructor')).toBe(false);
  });

  it('returns provided correlation id when valid', () => {
    const correlationId = 'rfid-req-12345678';
    expect(resolveCorrelationId(correlationId)).toBe(correlationId);
  });

  it('generates a safe correlation id when invalid', () => {
    const correlationId = resolveCorrelationId('<invalid>');
    expect(correlationId).not.toBe('<invalid>');
    expect(correlationId).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
  });

  it('resolves redirect only for dashboard-relative paths', () => {
    const dashboardUrl = 'https://app.example.com/dashboard/overview';
    expect(resolveRedirect(dashboardUrl, '/dashboard/feedback')).toBe(
      'https://app.example.com/dashboard/feedback',
    );
    expect(resolveRedirect(dashboardUrl, 'https://evil.example')).toBe(dashboardUrl);
    expect(resolveRedirect(dashboardUrl, '/auth/login')).toBe(dashboardUrl);
  });

  it('encrypts and decrypts secret payload', () => {
    const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const secret = 'TOP_SECRET_2FA_VALUE';

    const encrypted = encryptSecret(secret, key);
    expect(encrypted.hash).toMatch(/^[a-f0-9]{64}$/);
    const decrypted = decryptSecret(encrypted, key);

    expect(decrypted).toBe(secret);
  });
});
