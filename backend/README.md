# RFID SaaS Backend (NestJS + Prisma)

Secure authentication backend for the RFID dashboard frontend.

## Core Modules

- `AuthModule`: register/login (email or phone identifier), TOTP 2FA login, Google OAuth login, magic link, refresh, logout, session
- `UsersModule`: paginated user management
- `RolesModule`: paginated role management
- `TenantsModule`: paginated tenant management

## Security Controls

- Password hashing with `bcrypt`
- Access + refresh JWT with rotation
- Rate limiting (`@nestjs/throttler`)
- Input validation and sanitization (DTO + `ValidationPipe`)
- Secure headers (`helmet`)
- CORS allowlist by env
- Prisma parameterized queries to reduce injection risk
- Refresh token hashing and revocation

Detailed OWASP mapping: `backend/docs/security.md`.

## Environment Variables

1. Copy `backend/.env.example` to `backend/.env`.
2. Fill at minimum:
   - `DATABASE_URL`
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `TRUST_PROXY_HOPS` (set to `0` unless you run behind trusted reverse proxies)
   - `DEFAULT_SIGNUP_ROLE_NAME` (recommended: `member`)
3. For email delivery in production, set:
   - `EMAIL_PROVIDER=smtp`
   - `EMAIL_FROM`
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_SECURE`
   - `SMTP_USER`
   - `SMTP_PASS`
4. Optional (recommended for multi-instance deployments):
   - `AUTH_ATTEMPT_REDIS_URL`
   - `AUTH_ATTEMPT_REDIS_PREFIX`

## Setup

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

## Auth Endpoints

- `POST /auth/register` (alias: `/auth/signup`)
- `POST /auth/login` (alias: `/auth/signin`) with `identifier` (`email` or `phone`) + `password` -> may start 2FA challenge
- `POST /auth/login/verify-2fa` (alias: `/auth/signin/verify-2fa`) -> verifies TOTP code and returns JWTs
- `POST /auth/google` (alias: `/auth/google/verify`)
- `POST /auth/magic-link`
- `POST /auth/magic-link/verify`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/session`

Successful auth responses include `redirectTo` for frontend dashboard redirection.
