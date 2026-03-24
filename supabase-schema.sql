-- ============================================================
-- Equipment Maintenance App — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── Equipment table ──────────────────────────────────────────
-- Each row represents a unique piece of equipment with a QR code.
-- The `qr_id` is what gets encoded into the QR code (e.g. "EQ-001").

create table if not exists equipment (
  id          uuid primary key default gen_random_uuid(),
  qr_id       text unique not null,        -- value encoded in the QR code
  name        text not null,               -- e.g. "Compressor Unit A"
  type        text,                        -- e.g. "HVAC", "Electrical"
  location    text,                        -- e.g. "Roof Level 2"
  notes       text,                        -- any static notes about the equipment
  created_at  timestamptz default now()
);

-- ── Maintenance records table ────────────────────────────────
create table if not exists maintenance_records (
  id              uuid primary key default gen_random_uuid(),
  equipment_id    uuid references equipment(id) on delete cascade,
  technician_name text not null,
  service_date    date not null,
  status          text not null check (status in ('in_service', 'out_of_service', 'pending')),
  inspection_notes text,
  parts_replaced  text[],                  -- array of part names/numbers
  synced_at       timestamptz default now(),
  created_by      uuid references auth.users(id)
);

-- ── Indexes for common queries ────────────────────────────────
create index if not exists idx_records_equipment on maintenance_records(equipment_id);
create index if not exists idx_records_date      on maintenance_records(service_date desc);
create index if not exists idx_equipment_qr      on equipment(qr_id);

-- ── Row Level Security ────────────────────────────────────────
-- Only authenticated users in your org can read/write records.

alter table equipment          enable row level security;
alter table maintenance_records enable row level security;

-- All signed-in users can view equipment
create policy "Authenticated users can view equipment"
  on equipment for select
  using (auth.role() = 'authenticated');

-- All signed-in users can view all maintenance records
create policy "Authenticated users can view records"
  on maintenance_records for select
  using (auth.role() = 'authenticated');

-- Signed-in users can insert records (attributed to them)
create policy "Authenticated users can insert records"
  on maintenance_records for insert
  with check (auth.role() = 'authenticated');

-- Users can only update their own records
create policy "Users can update their own records"
  on maintenance_records for update
  using (created_by = auth.uid());

-- ── Documents table ──────────────────────────────────────────
-- Stores links to technical docs, service procedures, and fleet-wide references.
-- equipment_id is NULL for global/fleet-wide documents.

create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  equipment_id uuid references equipment(id) on delete cascade,
  title        text not null,
  url          text not null,
  category     text not null check (category in (
                 'technical_drawing',
                 'service_procedure',
                 'approved_tow_vehicles',
                 'master_ops_doc'
               )),
  subcategory  text check (subcategory in (
                 'model_sb_standard',
                 'receiving',
                 'on_site',
                 'shipping',
                 'tram_rodeo'
               )),
  created_at   timestamptz default now()
);

create index if not exists idx_documents_equipment on documents(equipment_id);
create index if not exists idx_documents_category  on documents(category);

alter table documents enable row level security;

create policy "Authenticated users can view documents"
  on documents for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert documents"
  on documents for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete documents"
  on documents for delete
  using (auth.role() = 'authenticated');

-- ── Sample equipment data ─────────────────────────────────────
-- Remove or replace with your real equipment list.

insert into equipment (qr_id, name, type, location) values
  ('EQ-001', 'Compressor Unit A',  'HVAC',       'Roof — Level 2'),
  ('EQ-002', 'Generator Set B',    'Electrical',  'Basement'),
  ('EQ-003', 'Fire Pump #3',       'Safety',      'Pump Room'),
  ('EQ-004', 'Chiller Unit 1',     'HVAC',        'Mechanical Room'),
  ('EQ-005', 'Boiler System C',    'Plumbing',    'Utility Room')
on conflict (qr_id) do nothing;
