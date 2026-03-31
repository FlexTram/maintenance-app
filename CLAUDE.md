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
- **Storage:** Public `documents` bucket for static fleet PDFs. Public `inspection-photos` bucket for inspection/drop-off photos (compressed client-side, ~400KB each).
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
- **Trams 14 & 15**: `retired` status — serial numbers exist (SB0142021, SB0152021) for traceability but units are reassigned to ADA trams. Excluded from fleet counts, no service buttons, profile shows "See ADA Trams" note.
- **QR ID format**: `TRAM-01` ... `TRAM-32`, `ADA-01`, `ADA-02`
- **Manual lookup**: partial/fuzzy search across `tram_number`, `serial_number`, `qr_id`, and `name` — returns multiple results for selection (e.g. typing "ADA" shows both ADA trams)

## Database Schema

### equipment table
`id`, `qr_id`, `name`, `type`, `location`, `notes`, `tram_number`, `serial_number`, `model_year`, `manufacturer`, `model`, `canopy_details`, `status` (in_service/out_of_service/pending/retired), `status_note`, `status_updated_at`, `status_updated_by`, `created_at`

### maintenance_records table
`id`, `equipment_id`, `technician_name`, `service_date`, `status`, `inspection_notes`, `parts_replaced`, `record_type` (inspection/repair), `form_data` (jsonb), `synced_at`, `created_by`, `voided` (boolean), `voided_reason`, `voided_at`, `voided_by`, `edited_by`, `edited_at`, `edited_by_name`

### status_changes table
Full audit trail of every status change: `id`, `equipment_id`, `old_status`, `new_status`, `note`, `changed_by`, `changed_by_name`, `changed_at`

### documents table
`id`, `equipment_id` (NULL = fleet-wide), `title`, `url`, `category`, `subcategory`, `created_at`

## Documents
Static PDFs served from **Supabase Storage** (public `documents` bucket, CacheFirst PWA caching for offline access). Living/collaborative docs stay on Google Drive.

### Google Drive (living docs)
- **Master Ops Doc**: https://docs.google.com/document/d/1UxVvA_UKqpgSMCvBaHvL5mZphRSVgZc0/edit?usp=sharing&ouid=107508318059145291753&rtpof=true&sd=true
- **Operating Procedures**: Shipping / Load Out, Receiving / Load In, Event Days (Google Docs), Tram Rodeo (Google Drive PDF)

### Supabase Storage (static PDFs — cached offline)
- **Approved Tow Vehicles**: `documents/FlexTram_Tow_Vehicles_Maintenance_app_ref.pdf`
- **Trailer Loading**: `documents/trailer_load_plan_app_ref.pdf`
- **Technical Drawings > Model SB Standard**: `documents/FlexTram_Technical_Drawings_Dimensions_app_ref.pdf`
- **Technical Drawings > Wiring Diagram**: `documents/flextram_wiring_diagram_app_ref.pdf`

All 4 static docs are also in the `documents` table for dynamic queries from EquipmentPage/HomePage.

## Current Status
App is **deployed to production** and in field testing with technicians. All core features complete.

## Pending Tasks
- **QR codes** — print and label fleet once ready (waiting on field testing feedback)
- **Supabase MCP in VS Code** — OAuth works in CLI but VS Code extension needs a new session to pick up MCP tools. Start a new conversation if MCP tools aren't available.
- **Sync error surface** — `syncErrors` IndexedDB table is being populated on failures; no UI to view it yet. Could add a sync health screen or badge on HomePage later.

## Completed (Session 6 — March 31)
- ✅ Photo capture on inspection form — inline under each corner card (wheels/steering) and section-level (hitch/wiring/under/above). 12 photo spots, max 3 each. Client-side compression via Canvas API (~400KB). Stored in Supabase Storage `inspection-photos` bucket.
- ✅ Batch Drop-Off form — 4-step flow (Event Info → Select Trams → Condition Check → Sign Off). 6 quick-check items per tram (Good/Damage toggle). Photos available on all items for before/after documentation. Optional customer/site rep signature. Route: `/dropoff`
- ✅ Tiered "Pending sync" badge — gray (<30 min) → amber "Sync delayed" (30 min–24 hrs) → red "Sync failed" (>24 hrs)
- ✅ Sync error logging — failed Supabase uploads written to IndexedDB `syncErrors` table (db version 2)
- ✅ Void button styled red
- ✅ Tire pressure input clamped to minimum 0 (no negatives)
- ✅ Code cleanup — extracted SyncBadge, FormSubmitBar, ADARadio shared components; parallel sync via Promise.all; deduplicated RepairForm
- ✅ RecordTypeBadge now supports 3 types: Inspection (blue), Repair (orange), Drop-Off (green)
- ✅ Recently serviced cards show serial number instead of redundant QR ID
- ✅ Added missing index on `maintenance_records.edited_by` (Supabase perf advisory)

## Completed (Session 5 — March 30)
- ✅ Edit functionality for inspection and repair records (Edit button, pre-populated forms, edit audit trail)
- ✅ Record sync bug fixed — `created_at` was causing silent Supabase insert failures; records now sync correctly

## Completed (Session 4 — March 27)
- ✅ All 4 Operating Procedure links wired up (Shipping / Load Out, Receiving / Load In, Event Days, Tram Rodeo)
- ✅ Master Ops Doc URL updated
- ✅ Code splitting — lazy-loaded 7 pages, main bundle 823KB → 452KB (45% smaller)
- ✅ Supabase performance fixes — RLS policies optimized, missing index added
- ✅ Supabase MCP authenticated via CLI OAuth
- ✅ CLAUDE.md fully updated with infra notes, Node v8 gotcha, MCP setup

## Key Files
- `src/lib/supabase.js` – Supabase client
- `src/lib/auth.jsx` – Auth context + Google OAuth
- `src/lib/db.js` – Local IndexedDB helpers
- `src/lib/sync.js` – Sync logic; `getEquipmentByIdentifier()` (fuzzy search), `saveRecord()`, `editRecord()`, `voidRecord()`, `flushPendingRecords()` (logs failures to `syncErrors`), `getStatusChangesForEquipment()`, `getAllStatusChanges()`
- `src/pages/LoginPage.jsx` – Login screen with Flextram artwork
- `src/pages/HomePage.jsx` – Dashboard with 3 stat cards (In Service / Out of Service / Pending), icons on nav buttons
- `src/pages/RecordsPage.jsx` – Fleet equipment list + all records timeline with color-coded filter tabs
- `src/pages/DocsPage.jsx` – Reference docs page (hardcoded, no Supabase needed)
- `src/pages/EquipmentPage.jsx` – Vehicle profile card + status toggle + timeline (Active Records + Voided Records + status group cards)
- `src/pages/ScanPage.jsx` – QR scan + manual entry (tram #, serial, or QR ID)
- `src/pages/InspectionForm.jsx` – Inspection form (routes: `/equipment/:id/new/inspection`, `/equipment/:id/edit/:recordId/inspection`). Also exports shared components: `FormSectionHeader`, `FormField`, `FormSubmitBar`, `ADARadio`, `PhotoSection`, `compressImage`, `uploadSectionPhotos`
- `src/pages/RepairForm.jsx` – Repair form (routes: `/equipment/:id/new/repair`, `/equipment/:id/edit/:recordId/repair`)
- `src/pages/BatchDropOffForm.jsx` – Batch drop-off form (route: `/dropoff`). 4-step multi-step flow for event delivery logging. `record_type: 'dropoff'`
- `src/index.css` – All styles (CSS variables, utility classes). max-width: 680px
- `vite.config.js` – Vite + PWA config
- `supabase-schema.sql` – Full DB schema
- `.claude/settings.local.json` – Local Claude config (gitignored)
- `.claude/run-supabase-mcp.sh` – MCP wrapper script that forces Node 20 (gitignored)
- `.mcp.json` – MCP server config (HTTP/OAuth to Supabase)
