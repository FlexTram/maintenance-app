# Maintenance App – Claude Session Context

## Project
Flextram fleet maintenance logger PWA built with React + Vite + Supabase.
Located at: `~/Desktop/Maintenance App Project`

## Stack
- **Frontend:** React, React Router, Vite, vite-plugin-pwa
- **Backend:** Supabase Pro (Postgres + Auth)
- **Hosting:** Vercel (auto-deploys from GitHub push to `master`)
- **Repo:** https://github.com/FlexTram/maintenance-app

## URLs
- **Production:** https://maintenance-app-liart.vercel.app
- **Local:** http://localhost:5173
- **Phone (local network):** http://192.168.1.251:5173 (Google OAuth blocks raw IPs — use Vercel for phone testing)

## Supabase
- **Project ID:** `lpsumqpbvhphtodffmeo`
- **Project URL:** https://lpsumqpbvhphtodffmeo.supabase.co
- **Plan:** Pro ($25/mo) — no pausing, priority support
- **Auth providers enabled:** Google OAuth, Email
- **Storage:** Public `documents` bucket for static fleet PDFs (technical drawings, wiring diagrams, tow vehicles, trailer loading)
- **Schema:** see `supabase-schema.sql`
- **MCP:** Configured via `.mcp.json` (HTTP/OAuth to `https://mcp.supabase.com/mcp`). Authenticated via CLI (`claude mcp add`). Falls back to Management API via curl with access token.
- **Management API (fallback):** `curl -H "Authorization: Bearer $TOKEN" https://api.supabase.com/v1/projects/lpsumqpbvhphtodffmeo/database/query -d '{"query":"SQL"}'`

## Running Locally
```bash
cd ~/Desktop/"Maintenance App Project"
npx vite --host
```
**Node version:** System default is now Node 20 via `nvm alias default v20.20.1`. If `node --version` shows v8, run `source ~/.nvm/nvm.sh && nvm use default`. The VS Code integrated shell may still pick up `/usr/local/bin/node` (v8) — use full path `/Users/josephbradley/.nvm/versions/node/v20.20.1/bin/node` as a workaround when needed.

## Env Variables
Stored in `.env.local` (not committed). Also set in Vercel dashboard.
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Google OAuth
- Callback URL: `https://lpsumqpbvhphtodffmeo.supabase.co/auth/v1/callback`
- Authorized JavaScript origins: `http://localhost:5173`, `https://maintenance-app-liart.vercel.app`
- Managed in: Google Cloud Console → APIs & Services → Credentials
- Note: Raw IPs (192.168.x.x) are rejected by Google OAuth — use Vercel URL for phone testing

## Deployment
Push to `master` → Vercel auto-deploys. Or manually:
```bash
vercel --prod --yes
```

## Infrastructure Notes
- **Supabase Pro** — upgraded from free tier. No pausing, no cold starts.
- **PGRST002 root cause resolved** — Data API was disabled on the original project. Re-enabling it fixed all 503 errors. If this ever recurs: Supabase Dashboard → Settings → API → ensure Data API is enabled.
- **Local IndexedDB cache** means the app works offline for equipment records/service history. Supabase outages only affect login, documents, and cloud sync.
- **Development workflow**: All development done locally at `http://localhost:5173`. Push to `master` for Vercel auto-deploy only when ready to ship a feature.
- **Phone testing**: Use Vercel production URL — Google OAuth blocks local IPs on mobile.
- **Security**: `.claude/` directory is gitignored — never commit tokens or `settings.local.json`. Prior tokens (sbp_5c3e7b..., sbp_c0436...) were revoked. Current auth uses OAuth via `.mcp.json`.
- **Node v8 gotcha**: `/usr/local/bin/node` is v8.11.3 and cannot be removed easily. Any `#!/usr/bin/env node` shebang (including `npx`) resolves to v8 unless `PATH` is overridden. The `.claude/run-supabase-mcp.sh` wrapper exists for this reason.

## Fleet Data (loaded in Supabase)
- **34 trams** inserted: TRAM-01 through TRAM-32, ADA-01, ADA-02
- **Trams 14 & 15**: have serial numbers (SB0142021, SB0152021) but "DNE — Refer to ADA unit" in notes
- **QR ID format**: `TRAM-01` ... `TRAM-32`, `ADA-01`, `ADA-02`
- **Manual lookup**: searches `tram_number`, `serial_number`, or `qr_id` — all three work on the scan page

## Database Schema

### equipment table
`id`, `qr_id`, `name`, `type`, `location`, `notes`, `tram_number`, `serial_number`, `model_year`, `manufacturer`, `model`, `canopy_details`, `status` (in_service/out_of_service/pending), `status_note`, `status_updated_at`, `status_updated_by`, `created_at`

### maintenance_records table
`id`, `equipment_id`, `technician_name`, `service_date`, `status`, `inspection_notes`, `parts_replaced`, `record_type` (inspection/repair), `form_data` (jsonb), `synced_at`, `created_by`

### status_changes table
Full audit trail of every status change: `id`, `equipment_id`, `old_status`, `new_status`, `note`, `changed_by`, `changed_at`

### documents table
`id`, `equipment_id` (NULL = fleet-wide), `title`, `url`, `category`, `subcategory`, `created_at`

## Documents
Static PDFs served from **Supabase Storage** (public `documents` bucket, CacheFirst PWA caching for offline access). Living/collaborative docs stay on Google Drive.

### Google Drive (living docs)
- **Master Ops Doc**: https://docs.google.com/document/d/1MGR67rlNZeCjyFj4tUyvzjliYdWEo1MOI8Q6gWQm41s/edit?usp=drive_link
- **Operating Procedures** (Shipping, Receiving, Event Days, Tram Rodeo): links TBD — currently show "Coming soon"

### Supabase Storage (static PDFs — cached offline)
- **Approved Tow Vehicles**: `documents/FlexTram_Tow_Vehicles_Maintenance_app_ref.pdf`
- **Trailer Loading**: `documents/trailer_load_plan_app_ref.pdf`
- **Technical Drawings > Model SB Standard**: `documents/FlexTram_Technical_Drawings_Dimensions_app_ref.pdf`
- **Technical Drawings > Wiring Diagram**: `documents/flextram_wiring_diagram_app_ref.pdf`

All 4 static docs are also in the `documents` table for dynamic queries from EquipmentPage/HomePage.

## Pending Tasks
- **Operating Procedures links** — need G Drive links for Shipping, Receiving, Event Days, Tram Rodeo
- **QR codes** — print and label fleet once ready

## Key Files
- `src/lib/supabase.js` – Supabase client
- `src/lib/auth.jsx` – Auth context + Google OAuth
- `src/lib/db.js` – Local IndexedDB helpers
- `src/lib/sync.js` – Sync logic; includes `getEquipmentByIdentifier()` for multi-field tram lookup
- `src/pages/LoginPage.jsx` – Login screen with Flextram artwork
- `src/pages/HomePage.jsx` – Dashboard with 3 stat cards (In Service / Out of Service / Pending), Quick Document Reference button
- `src/pages/DocsPage.jsx` – Reference docs page (hardcoded, no Supabase needed)
- `src/pages/EquipmentPage.jsx` – Vehicle profile card + status toggle + maintenance history
- `src/pages/ScanPage.jsx` – QR scan + manual entry (tram #, serial, or QR ID)
- `src/pages/InspectionForm.jsx` – Inspection form (routes: `/equipment/:id/new/inspection`)
- `src/pages/RepairForm.jsx` – Repair form (routes: `/equipment/:id/new/repair`)
- `src/index.css` – All styles (CSS variables, utility classes). max-width: 680px
- `vite.config.js` – Vite + PWA config
- `supabase-schema.sql` – Full DB schema
- `.claude/settings.local.json` – Local Claude config (gitignored)
- `.claude/run-supabase-mcp.sh` – MCP wrapper script that forces Node 20 (gitignored)
- `.mcp.json` – MCP server config (HTTP/OAuth to Supabase)
