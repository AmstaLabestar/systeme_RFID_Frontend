# OWASP Top 10 Coverage

This backend applies defensive controls aligned to OWASP Top 10 (2021):

1. `A01 Broken Access Control`
- JWT guard on protected routes.
- Role guard for admin endpoints (`users`, `roles`, `tenants`).
- Tenant/role consistency checks before user creation.

2. `A02 Cryptographic Failures`
- `bcrypt` password hashing.
- Signed access and refresh JWTs with separate secrets.
- Refresh tokens stored as SHA-256 hashes in DB.

3. `A03 Injection`
- Prisma ORM parameterized queries.
- DTO validation + whitelist blocking unknown payload fields.
- Input sanitization pipe for body/query strings.

4. `A04 Insecure Design`
- Modular boundaries (controller/service/repository).
- Token rotation and revocation flows.
- Two-factor attempt limits and short-lived step tokens.

5. `A05 Security Misconfiguration`
- `helmet` secure headers.
- CORS allowlist from environment.
- Strong env validation for secrets and auth config.
- `/metrics` can be protected with basic authentication (`METRICS_AUTH_MODE=basic`) and should be restricted at reverse proxy/network layer in production.

6. `A06 Vulnerable and Outdated Components`
- Dedicated backend package with explicit dependencies.
- Lockfile + regular patch strategy expected in CI.

7. `A07 Identification and Authentication Failures`
- Access + refresh token model.
- Login attempt throttling (global + auth-specific buckets).
- Two-factor login using TOTP authenticator codes.
- Identifier-based login supports email or phone.

8. `A08 Software and Data Integrity Failures`
- Env-driven secret management (no hardcoded secrets).
- Prisma schema-managed data model and migrations.

9. `A09 Security Logging and Monitoring Failures`
- Request-level metadata persisted for refresh token issuance.

10. `A10 SSRF`
- Outbound webhook targets are admin-configured and validated before persistence.
- URL validation blocks private/loopback/reserved destinations and enforces HTTPS in production.
- External calls remain limited to explicit providers (Google token verify, SMTP, validated webhooks).
