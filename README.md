# Equipment Maintenance Logger

A Progressive Web App (PWA) for logging equipment maintenance records via QR code scanning.
Works offline — records sync to Supabase automatically when connectivity returns.

---

## Tech stack

| Layer        | Choice             |
|--------------|--------------------|
| Frontend     | React + Vite       |
| PWA / Offline| vite-plugin-pwa + Workbox |
| Local storage| Dexie (IndexedDB)  |
| Database     | Supabase (Postgres)|
| Auth         | Supabase Google OAuth |
| QR scanning  | html5-qrcode       |
| Hosting      | Vercel or Netlify  |

---

## Setup — step by step

### 1. Install dependencies

```bash
cd maintenance-app
npm install
```

---

### 2. Create your Supabase project

1. Go to https://supabase.com and sign in
2. Click **New project**, give it a name (e.g. "maintenance-app")
3. Choose a region close to your team
4. Wait ~2 minutes for it to provision

---

### 3. Run the database schema

1. In your Supabase dashboard, go to **SQL Editor → New Query**
2. Paste the contents of `supabase-schema.sql`
3. Click **Run**

This creates the `equipment` and `maintenance_records` tables, sets up
Row Level Security, and inserts some sample equipment to test with.

---

### 4. Enable Google OAuth

1. Go to **Authentication → Providers → Google** in your Supabase dashboard
2. Toggle it on
3. You'll need a Google OAuth Client ID and Secret:
   - Go to https://console.cloud.google.com
   - Create a new project (or use an existing one)
   - Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
   - Application type: **Web application**
   - Add your site URL to **Authorized JavaScript origins**
   - Add `https://your-project-id.supabase.co/auth/v1/callback` to **Authorized redirect URIs**
   - Copy the Client ID and Secret back into Supabase
4. In Supabase: **Authentication → URL Configuration**, set:
   - Site URL: your production URL (e.g. `https://your-app.vercel.app`)
   - Add `http://localhost:5173` to Redirect URLs for local development

---

### 5. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values from
**Supabase Dashboard → Project Settings → API**:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

### 6. Run locally

```bash
npm run dev
```

Open http://localhost:5173 — sign in with Google, then scan a QR code
(or type `EQ-001` manually to test with sample data).

---

### 7. Generate QR codes for your equipment

1. Add your real equipment to the `equipment` table in Supabase
   (via the Table Editor or by editing `supabase-schema.sql`)
2. For each piece of equipment, generate a QR code encoding its `qr_id` value
   (e.g. the text `EQ-001`)
3. Use any free generator — https://www.qr-code-generator.com or https://qrcode.tec-it.com
4. Print and attach to the equipment (laminated labels work well)

---

### 8. Deploy to Vercel (recommended)

```bash
npm install -g vercel
vercel
```

Follow the prompts. When asked for environment variables, add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

After deploying, copy your production URL (e.g. `https://your-app.vercel.app`)
back into Supabase under **Authentication → URL Configuration → Site URL**.

**Alternatively — Netlify:**
```bash
npm run build
# Drag the `dist/` folder to https://app.netlify.com/drop
```
Add the same env vars in **Site settings → Environment variables**, then redeploy.

---

### 9. Install on phones (optional but recommended)

Once deployed, open the URL on each technician's phone:

- **iPhone (Safari):** tap the Share button → "Add to Home Screen"
- **Android (Chrome):** tap the menu → "Add to Home Screen" (or accept the install prompt)

The app will behave like a native app — full screen, no browser chrome,
works offline after the first load.

---

## Adding equipment

### Via Supabase Table Editor (easiest)
1. Go to **Table Editor → equipment** in your Supabase dashboard
2. Click **Insert row**
3. Fill in `qr_id`, `name`, `type`, `location`
4. The `qr_id` is what gets encoded into the QR code — keep it short and unique
   (e.g. `EQ-042`, `PUMP-03`, `HVAC-ROOF-1`)

### Via SQL
```sql
insert into equipment (qr_id, name, type, location)
values ('EQ-006', 'Air Handler Unit 2', 'HVAC', 'Floor 3 — East Wing');
```

---

## Project structure

```
maintenance-app/
├── src/
│   ├── lib/
│   │   ├── supabase.js      # Supabase client
│   │   ├── db.js            # Dexie / IndexedDB schema
│   │   ├── sync.js          # Offline-first data layer ← key file
│   │   └── auth.jsx         # Google OAuth context
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── HomePage.jsx
│   │   ├── ScanPage.jsx
│   │   ├── EquipmentPage.jsx
│   │   ├── NewRecordPage.jsx
│   │   └── RecordsPage.jsx
│   ├── App.jsx              # Routes + offline banner
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles
├── supabase-schema.sql      # Run this in Supabase SQL Editor
├── .env.example             # Copy to .env.local
├── vite.config.js           # Vite + PWA config
└── package.json
```

---

## How offline sync works

1. Technician fills out a record — saved to **IndexedDB immediately** (no network needed)
2. App attempts to sync to Supabase right away
3. If offline, the record is marked `synced: 0` and shown with a "Pending sync" badge
4. When the device comes back online, `flushPendingRecords()` runs automatically
   and pushes all pending records to Supabase
5. Records confirmed in Supabase are marked `synced: 1`

All reads come from IndexedDB first, so the app is fully usable with no signal.

---

## Keeping the free tier alive (optional)

Supabase pauses free projects after 7 days of inactivity. To prevent this,
set up a free ping using UptimeRobot (https://uptimerobot.com):

1. Create a free account
2. Add a new monitor: **HTTP(s)**, URL = your Supabase project URL + `/rest/v1/equipment?limit=1`
3. Add your anon key as a header: `apikey: your-anon-key`
4. Set interval to every 3 days

This keeps the project alive indefinitely on the free tier.
