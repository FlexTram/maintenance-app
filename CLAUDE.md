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
- **Schema:** see `supabase-schema.sql`
- **MCP token:** stored in `.claude/settings.local.json` (gitignored)

## Running Locally
Dev server must use Node 20 directly (system Node is v8 — causes failures):
```bash
cd ~/Desktop/"Maintenance App Project"
/Users/josephbradley/.nvm/versions/node/v20.20.1/bin/node ./node_modules/.bin/vite --host
```

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
- **Security**: `.claude/settings.local.json` is gitignored — never commit it. A prior token (sbp_5c3e7b...) was accidentally exposed and has been revoked.

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

## Documents (hardcoded in DocsPage — no Supabase dependency)
- **Master Ops Doc**: https://docs.google.com/document/d/1MGR67rlNZeCjyFj4tUyvzjliYdWEo1MOI8Q6gWQm41s/edit?usp=drive_link
- **Approved Tow Vehicles**: https://drive.google.com/file/d/19TqX2YZZ1eWnKg88UeROQDAdYvaFJ_zZ/view?usp=drive_link
- **Technical Drawings > Model SB Standard**: https://drive.google.com/file/d/1ZQw-n5XnmILVMTgnjKCGqqDgWtbV2j86/view?usp=drive_link
- **Technical Drawings > Model SB Standard Wiring Diagram**: https://drive.google.com/file/d/1uFPImoT0-kifxrK91ocsDGpAIgrhFTJg/view?usp=drive_link
- **Operating Procedures** (Shipping, Receiving, Event Days, Tram Rodeo): links TBD — currently show "Coming soon"

## Pending Tasks
- **Operating Procedures links** — need G Drive links for Shipping, Receiving, Event Days, Tram Rodeo
- **Inspection & Repair forms** — HTML files exist at `~/Downloads/flextram_inspection_form.html` and `~/Downloads/flextram_repairs_form.html`. Need to be built as React components (`InspectionForm.jsx`, `RepairForm.jsx`) with routes `/equipment/:id/new/inspection` and `/equipment/:id/new/repair`
- **Schema migration** — run in Supabase SQL Editor if not yet applied:
  ```sql
  ALTER TABLE maintenance_records
    ADD COLUMN IF NOT EXISTS record_type text CHECK (record_type IN ('inspection', 'repair')),
    ADD COLUMN IF NOT EXISTS form_data jsonb;
  ```
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
- `src/pages/InspectionForm.jsx` – Inspection form (TODO: build)
- `src/pages/RepairForm.jsx` – Repair form (TODO: build)
- `src/index.css` – All styles (CSS variables, utility classes). max-width: 680px
- `vite.config.js` – Vite + PWA config
- `supabase-schema.sql` – Full DB schema
- `.claude/settings.local.json` – Supabase MCP config (gitignored)
