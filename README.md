
  # SaaS B2B Access Management Interface

  This is a code bundle for SaaS B2B Access Management Interface. The original project is available at https://www.figma.com/design/YRST9xVizVnwqwCmTdQshQ/SaaS-B2B-Access-Management-Interface.

  ## Running the code

  Run `npm i` to install the dependencies.

  Create `.env.local` from `.env.example` and set your Google OAuth Client ID.

  Run `npm run dev:api` to start the mock auth API (port `4011` by default).

  Run `npm run dev` to start the frontend.

  ### OAuth / OTP routes

  - Google callback: `/auth/google/callback`
  - WhatsApp OTP auth: `/auth/whatsapp`
  
