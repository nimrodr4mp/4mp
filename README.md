# 4MP — ניהול מכירות

Sales management system for 4MP, a manufacturer of aesthetic machines. Salespeople run a CRM
pipeline and sales meetings, close equipment deals, and 4MP's technicians install the machines
at the customer site. React 19 + TypeScript + Vite + Tailwind (RTL, Hebrew UI) + Supabase.

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the schema** — open the SQL Editor in your Supabase project and run the contents of
   [`supabase/schema.sql`](supabase/schema.sql). This creates all tables, disables RLS, grants
   access to the `anon` role, seeds the machine catalog, and creates the first admin user
   (`admin@4mp.co.il`).
3. **Set environment variables** — copy `.env.example` to `.env` and fill in:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   Both values are in your Supabase project's Settings → API page.
4. **Install dependencies**:
   ```
   npm install
   ```
5. **Run the dev server**:
   ```
   npm run dev
   ```
6. **Set the admin password** — the seeded admin user has no password yet, so generate one locally
   with Node (matches the app's PBKDF2 params exactly):
   ```
   node -e "const c=require('crypto');const s=c.randomBytes(32).toString('hex');const h=c.pbkdf2Sync('your-new-password',Buffer.from(s,'hex'),100000,32,'sha256').toString('hex');console.log('salt:',s);console.log('hash:',h)"
   ```
   Copy the printed `salt`/`hash` into the `app_users` row's `password_salt`/`password_hash`
   columns in the Supabase Table Editor. From then on, log in as `admin@4mp.co.il` and use
   **משתמשים → קביעת סיסמה** to set passwords for all future users through the UI.

## Security model

No Supabase Auth. Login goes through a serverless function, [`api/login.ts`](api/login.ts), which:

1. verifies the PBKDF2 password server-side using the Supabase **service_role** key, then
2. mints a short-lived (7-day) HS256 JWT signed with the project's **JWT secret**.

The browser stores that token and sends it with every Supabase request (via supabase-js's
`accessToken` option). **Row Level Security** ([`supabase/rls.sql`](supabase/rls.sql)) then enforces:
the anon key alone can read/write nothing; any valid token can use the operational tables;
`app_users` (password hashes) is admin-only. A non-secret `app_users_public` view exposes just
names/roles for lookups.

Four environment variables are required (see `.env.example`):

| Var | Where | Exposed to browser? |
|-----|-------|---------------------|
| `VITE_SUPABASE_URL` | Supabase → Settings → API | yes (safe) |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API | yes (safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (secret) | **no** |
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → JWT Settings | **no** |

Local `npm run dev` mounts `api/login` into the Vite dev server, so the two server secrets must be
present in your local `.env` for login to work locally.

## Deploy (Vercel)

1. **Push to GitHub** (already wired to `origin`).
2. **Import** the repo at [vercel.com](https://vercel.com) — it auto-detects Vite. `vercel.json`
   handles the SPA rewrite and Vercel auto-builds `api/*.ts` as serverless functions.
3. **Add all four env vars** in Vercel → Settings → Environment Variables (the two `VITE_` ones
   and the two secrets). Redeploy.
4. **Enable RLS** — run [`supabase/rls.sql`](supabase/rls.sql) in the Supabase SQL Editor. Do this
   *after* the deploy is live and you've confirmed login works, since it closes off the old anon
   access the app previously relied on.
5. **Custom domain** — Vercel → Settings → Domains, then point your DNS (CNAME →
   `cname.vercel-dns.com`) at it.

## Notes

- Because auth is a stateless JWT, there is no instant "revoke session" — tokens simply expire
  after 7 days. Deactivating a user (`is_active`) blocks their *next* login.
- No inventory, BOM, suppliers, purchase orders, or clinic-style appointments — machines are a
  simple catalog, and installations are the only "field work" record.
