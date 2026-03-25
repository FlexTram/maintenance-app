# Maintenance App – Claude Session Context

## Project
Flextram fleet maintenance logger PWA built with React + Vite + Supabase.
Located at: `~/Desktop/Maintenance App Project`

## Stack
- **Frontend:** React, React Router, Vite, vite-plugin-pwa
- **Backend:** Supabase (Postgres + Auth)
- **Hosting:** Vercel (auto-deploys from GitHub push to `master`)
- **Repo:** https://github.com/FlexTram/maintenance-app

## URLs
- **Production:** https://maintenance-app-liart.vercel.app
- **Local:** http://localhost:5173
- **Phone (local network):** http://192.168.1.251:5173 (Google OAuth blocks raw IPs — use Vercel for phone testing)

## Supabase
- **Project ID:** `lpsumqpbvhphtodffmeo`
- **Project URL:** https://lpsumqpbvhphtodffmeo.supabase.co
- **Auth providers enabled:** Google OAuth, Email
- **Schema:** see `supabase-schema.sql`
- **MCP token:** stored in `.mcp.json` (gitignored)

## Running Locally
Dev server must use Node 20 directly (system Node is v8 — causes failures):
```bash
cd ~/Desktop/"Maintenance App Project"
/Users/josephbradley/.nvm/versions/node/v20.20.1/bin/node ./node_modules/.bin/vite --host
```
Or if nvm is loaded in the current shell:
```bash
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && nvm use 20
npm run dev -- --host
```

## Env Variables
Stored in `.env.local` (not committed). Also set in Vercel dashboard.
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Google OAuth
- Callback URL: `https://lpsumqpbvhphtodffmeo.supabase.co/auth/v1/callback`
- Authorized JavaScript origins: `http://localhost:5173`, `https://maintenance-app-liart.vercel.app`
- Managed in: Google Cloud Console → APIs & Services → Credentials
- Note: Raw IPs (192.168.x.x) are rejected by Google OAuth — can't test on phone via local network

## Deployment
Push to `master` → Vercel auto-deploys. Or manually:
```bash
vercel --prod --yes
```

## Infrastructure Notes
- **Supabase free tier** pauses projects after 1 week of inactivity (cold start ~20-30s).
- **PGRST002 PostgREST bug** — ongoing outage on project `lpsumqpbvhphtodffmeo`. Support ticket filed. All `/rest/v1/` calls return 503. Auth works fine. Direct SQL via MCP works fine.
- **Backup plan**: Upgrade to Supabase Pro ($25/mo) — same code, no migration, no pausing, fixes PostgREST instability. Alternatives: Neon (serverless Postgres, fast cold starts, free), Firebase (requires auth + db rewrite).
- **Local IndexedDB cache** means the app works offline for equipment records/service history. Supabase outages only affect login, documents, and cloud sync.
- **Development workflow**: All development done locally at `http://localhost:5173`. Push to `master` for Vercel auto-deploy only when ready to ship a feature.
- **Phone testing**: Use Vercel production URL — Google OAuth blocks local IPs on mobile.

## Fleet Data (loaded in Supabase)
- **34 trams** inserted: TRAM-01 through TRAM-32, ADA-01, ADA-02
- **Trams 14 & 15**: have serial numbers (SB0142021, SB0152021) but "DNE — Refer to ADA unit" in notes
- **QR ID format**: `TRAM-01` ... `TRAM-32`, `ADA-01`, `ADA-02`
- **Equipment table columns**: `id`, `qr_id`, `name`, `type`, `location`, `notes`, `tram_number`, `serial_number`, `model_year`, `manufacturer`, `model`, `canopy_details`, `created_at`
- **Manual lookup**: searches `tram_number`, `serial_number`, or `qr_id` — all three work on the scan page

## Documents (hardcoded in DocsPage — no Supabase dependency)
- **Master Ops Doc**: https://docs.google.com/document/d/1MGR67rlNZeCjyFj4tUyvzjliYdWEo1MOI8Q6gWQm41s/edit?usp=drive_link
- **Approved Tow Vehicles**: https://drive.google.com/file/d/19TqX2YZZ1eWnKg88UeROQDAdYvaFJ_zZ/view?usp=drive_link
- **Technical Drawings > Model SB Standard**: https://drive.google.com/file/d/1ZQw-n5XnmILVMTgnjKCGqqDgWtbV2j86/view?usp=drive_link
- **Technical Drawings > Model SB Standard Wiring Diagram**: https://drive.google.com/file/d/1uFPImoT0-kifxrK91ocsDGpAIgrhFTJg/view?usp=drive_link
- **Operating Procedures** (Shipping, Receiving, Event Days, Tram Rodeo): links TBD — currently show "Coming soon"

## Pending Supabase Actions
When PostgREST outage is resolved, verify/confirm:
- **Documents table** has `category` column with values: `technical_drawing`, `service_procedure`, `approved_tow_vehicles`, `master_ops_doc`
- **RLS policy** on `documents` table: authenticated users can SELECT where `equipment_id IS NULL`
- **Global doc buttons** on HomePage should auto-appear once REST API is back (fetches `equipment_id IS NULL` docs)
- **Equipment sync**: After fix, log out and back in to trigger `syncEquipmentCache()` — this will pull all 34 trams into IndexedDB for offline use
- **Support ticket** filed for PGRST002 PostgREST schema cache error

## Key Files
- `src/lib/supabase.js` – Supabase client
- `src/lib/auth.jsx` – Auth context + Google OAuth
- `src/lib/db.js` – Local IndexedDB helpers
- `src/lib/sync.js` – Sync logic; includes `getEquipmentByIdentifier()` for multi-field tram lookup
- `src/pages/LoginPage.jsx` – Login screen with Flextram artwork
- `src/pages/HomePage.jsx` – Dashboard with stat cards, Quick Document Reference button
- `src/pages/DocsPage.jsx` – Reference docs page (hardcoded, no Supabase needed)
- `src/pages/EquipmentPage.jsx` – Vehicle profile card + maintenance history
- `src/pages/ScanPage.jsx` – QR scan + manual entry (tram #, serial, or QR ID)
- `src/index.css` – All styles (CSS variables, utility classes)
- `vite.config.js` – Vite + PWA config
- `supabase-schema.sql` – Full DB schema including vehicle profile columns
- `.mcp.json` – Supabase MCP config (gitignored, uses full Node 20 path)
