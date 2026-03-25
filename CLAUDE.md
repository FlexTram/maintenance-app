# Maintenance App – Claude Session Context

## Project
Equipment maintenance logger PWA built with React + Vite + Supabase.
Located at: `~/Downloads/maintenance-app`

## Stack
- **Frontend:** React, React Router, Vite, vite-plugin-pwa
- **Backend:** Supabase (Postgres + Auth)
- **Hosting:** Vercel (auto-deploys from GitHub on push)
- **Repo:** https://github.com/FlexTram/maintenance-app

## URLs
- **Production:** https://maintenance-app-liart.vercel.app
- **Local:** http://localhost:5173
- **Phone (local network):** http://192.168.1.251:5173

## Supabase
- **Project URL:** https://lpsumqpbvhphtodffmeo.supabase.co
- **Auth providers enabled:** Google OAuth, Email
- **Schema:** see `supabase-schema.sql`

## Running Locally
```bash
cd ~/Downloads/maintenance-app
npm run dev -- --host
```
Requires Node 20 via nvm. If nvm isn't loaded:
```bash
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && nvm use 20
```

## Env Variables
Stored in `.env.local` (not committed). Also set in Vercel dashboard.
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Google OAuth
- Callback URL: `https://lpsumqpbvhphtodffmeo.supabase.co/auth/v1/callback`
- Authorized origins: `http://localhost:5173`, `https://maintenance-app-liart.vercel.app`
- Managed in: Google Cloud Console → APIs & Services → Credentials

## Deployment
Push to `master` → Vercel auto-deploys. Or manually:
```bash
vercel --prod --yes
```

## Infrastructure Notes
- **Supabase free tier** pauses projects after 1 week of inactivity (cold start ~20-30s). Known issue.
- **PGRST002 PostgREST bug** — ongoing outage on project `lpsumqpbvhphtodffmeo`. Support ticket filed.
- **Backup plan**: When ready for production, upgrade to Supabase Pro ($25/mo) — same code, no migration, no pausing, fixes PostgREST instability. Alternatives: Neon (serverless Postgres, fast cold starts, free), Firebase (requires auth + db rewrite).
- **Local IndexedDB cache** means the app works offline for equipment records/service history. Supabase outages only affect login, documents, and cloud sync.
- **Development workflow**: All development done locally at `http://localhost:5173`. Push to `master` for Vercel auto-deploy only when ready to ship a feature.

## Pending Supabase Actions
When PostgREST outage is resolved, verify/confirm:
- **Documents table** has `category` column with values: `technical_drawing`, `service_procedure`, `approved_tow_vehicles`, `master_ops_doc`
- **RLS policy** on `documents` table: authenticated users can SELECT where `equipment_id IS NULL` (global docs) — policy uses `auth.uid() IS NOT NULL`
- **Global doc buttons** on HomePage should auto-appear once Supabase REST API is back (fetches `equipment_id IS NULL` docs)
- **DocsPage** (`/docs`) now shows all 4 categories — verify docs in each category display correctly
- **Support ticket** filed for PGRST002 PostgREST schema cache error

## Key Files
- `src/lib/supabase.js` – Supabase client
- `src/lib/auth.jsx` – Auth context + Google OAuth
- `src/lib/db.js` – Local IndexedDB helpers
- `src/lib/sync.js` – Sync logic between local DB and Supabase
- `src/pages/LoginPage.jsx` – Login screen with Flextram artwork
- `src/pages/HomePage.jsx` – Dashboard
- `src/index.css` – All styles (CSS variables, utility classes)
- `vite.config.js` – Vite + PWA config
