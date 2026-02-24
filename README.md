# RFID SaaS - Frontend + Backend

This repository contains:

- Frontend: React + TypeScript + Vite
- Backend: NestJS + Prisma + PostgreSQL

The frontend now consumes real backend endpoints only (no JSON Server).

## 1. Install dependencies

```bash
npm install
npm --prefix backend install
```

## 2. Configure environment

### Frontend

Create `.env.local` from `.env.example`:

```env
VITE_AUTH_API_URL=http://localhost:4012
VITE_SYSTEM_API_URL=http://localhost:4012
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
```

### Backend

Create `backend/.env` from `backend/.env.example` and fill at least:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `MAGIC_LINK_CALLBACK_URL`

## 3. Prepare backend database

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:seed
```

## 4. Run services

```bash
npm run dev:backend
npm run dev
```

- Backend default port: `4012`
- Frontend default port: `5173`

## API contracts

Frontend route contracts and mappers are centralized in:

- `src/app/services/contracts/routes.ts`
- `src/app/services/contracts/mappers.ts`

## Implemented backend domains

- Auth (`/auth/*`): email/phone login, register, Google, magic link, refresh, logout, session, TOTP 2FA
- Systems state (`/systems/*`)
- Marketplace (`/marketplace/*`)
- Access assignments (`/services/*`)
- Public feedback (`/public/feedback/:qrToken`)
