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

## Key Files
- `src/lib/supabase.js` – Supabase client
- `src/lib/auth.jsx` – Auth context + Google OAuth
- `src/lib/db.js` – Local IndexedDB helpers
- `src/lib/sync.js` – Sync logic between local DB and Supabase
- `src/pages/LoginPage.jsx` – Login screen with Flextram artwork
- `src/pages/HomePage.jsx` – Dashboard
- `src/index.css` – All styles (CSS variables, utility classes)
- `vite.config.js` – Vite + PWA config
