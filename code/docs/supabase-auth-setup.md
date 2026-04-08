# Supabase Auth Setup (Epic 2)

Use this checklist to configure Supabase authentication for local, preview, and production environments.

## 1) Enable providers

In Supabase Dashboard:

1. Open `Authentication` -> `Providers`
2. Enable:
   - Email (Email + Password)
   - GitHub OAuth

## 2) Configure site URLs

In `Authentication` -> `URL Configuration`:

- **Site URL**:
  - Local: `http://localhost:3000`
  - Production: your final domain (for example `https://forge.yourdomain.com`)

- **Redirect URLs** (add all):
  - `http://localhost:3000/login`
  - `http://localhost:3000/dashboard`
  - `https://forge.yourdomain.com/login`
  - `https://forge.yourdomain.com/dashboard`
  - `https://*.vercel.app/login` (optional previews)
  - `https://*.vercel.app/dashboard` (optional previews)

## 3) GitHub OAuth app setup

In GitHub Developer Settings -> OAuth Apps:

- **Authorization callback URL**:
  - `https://<project-ref>.supabase.co/auth/v1/callback`

Copy GitHub `Client ID` and `Client Secret` into Supabase GitHub provider settings.

## 4) Environment variables

Set these in `code/.env.example` and your runtime envs:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`

## 5) Verify login

1. Run web app: `pnpm --filter @forge/web dev`
2. Open `http://localhost:3000/register`
3. Create account with email/password
4. Sign in using email/password and GitHub OAuth
5. Confirm redirect to `/dashboard`
