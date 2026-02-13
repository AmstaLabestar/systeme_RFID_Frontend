
  # SaaS B2B Access Management Interface

  This is a code bundle for SaaS B2B Access Management Interface. The original project is available at https://www.figma.com/design/YRST9xVizVnwqwCmTdQshQ/SaaS-B2B-Access-Management-Interface.

  ## Running the code

  Run `npm i` to install the dependencies.

  Create `.env.local` from `.env.example` and set your Google OAuth Client ID.

  Run `npm run dev:api` to start the mock API (auth + systems, port `4011` by default).

  Run `npm run dev` to start the frontend.

  Frontend data fetching/caching is handled with React Query.

  All `marketplace` / `services` endpoints are user-scoped from the bearer token, so each user keeps an isolated dashboard state.

  To switch from mock backend to real backend, only update `.env.local`:
  - `VITE_AUTH_API_URL=https://your-auth-api`
  - `VITE_SYSTEM_API_URL=https://your-business-api`
  The frontend services already call REST endpoints with Axios/fetch and bearer token forwarding.

  API contract layer is centralized in:
  - `src/app/services/contracts/routes.ts` (all endpoint paths)
  - `src/app/services/contracts/mappers.ts` (DTO -> UI model and UI payload -> API payload)
  When your backend contract changes, update this layer without touching pages/contexts.

  ### OAuth / OTP routes

  - Google callback: `/auth/google/callback`
  - WhatsApp OTP auth: `/auth/whatsapp`

  ### Mock auth endpoints

  - `POST /auth/signup`
  - `POST /auth/signin`
  - `GET /auth/session`
  - `POST /auth/google/verify`
  - `POST /auth/whatsapp/request`
  - `POST /auth/whatsapp/verify`

  ### Mock systems endpoints

  - `GET /systems/state`
  - `GET /systems/marketplace-state`
  - `PUT /systems/marketplace-state`
  - `GET /systems/services-state`
  - `PUT /systems/services-state`

  ### Mock business endpoints

  - `GET /marketplace/catalog`
  - `GET /marketplace/state`
  - `POST /marketplace/purchases`
  - `POST /marketplace/devices/:deviceId/activate`
  - `GET /services/state`
  - `POST /services/assignments`
  - `DELETE /services/assignments/:assignmentId`
  - `POST /services/assignments/:assignmentId/reassign`
  
