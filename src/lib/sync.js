/**
 * sync.js — Offline-first data layer
 *
 * All reads and writes go through this module.
 * - Writes go to IndexedDB immediately (works offline).
 * - A sync queue flushes pending records to Supabase when online.
 * - Equipment is cached locally after the first successful fetch.
 */

import { db } from './db'
import { supabase } from './supabase'

// ── Equipment ─────────────────────────────────────────────────

/**
 * Look up equipment by QR code value.
 * Tries local cache first, falls back to Supabase if online.
 */
export async function getEquipmentByQrId(qrId) {
  // Try local cache first (works offline)
  const cached = await db.equipment.where('qr_id').equals(qrId).first()
  if (cached) return cached

  // Not cached — try Supabase
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('qr_id', qrId)
    .single()

  if (error || !data) return null

  // Cache it locally for offline use
  await db.equipment.put(data)
  return data
}

/**
 * Fetch and cache all equipment from Supabase.
 * Called on login so the full list is available offline.
 */
export async function syncEquipmentCache() {
  const { data, error } = await supabase.from('equipment').select('*')
  if (error || !data) return

  await db.equipment.bulkPut(data)
}

/**
 * Get all equipment from local cache (works offline).
 */
export async function getAllEquipment() {
  return db.equipment.toArray()
}

// ── Maintenance Records ───────────────────────────────────────

/**
 * Save a new maintenance record.
 *
 * Always writes to IndexedDB immediately so the technician gets
 * instant confirmation even with no signal. Then attempts to
 * sync to Supabase — if that fails, the record stays in the
 * queue and will be retried next time they're online.
 */
export async function saveRecord(record) {
  const localRecord = {
    ...record,
    id: crypto.randomUUID(),       // temp UUID, replaced by Supabase on sync
    synced: 0,                     // 0 = pending, 1 = synced
    created_at: new Date().toISOString(),
  }

  // Write locally first — this never fails (offline-safe)
  const localId = await db.records.add(localRecord)

  // Attempt immediate sync
  await flushPendingRecords()

  return { ...localRecord, localId }
}

/**
 * Get all records for a given equipment ID, from local cache.
 */
export async function getRecordsForEquipment(equipmentId) {
  return db.records
    .where('equipment_id')
    .equals(equipmentId)
    .reverse()
    .sortBy('service_date')
}

/**
 * Get all records from local cache, newest first.
 */
export async function getAllRecords() {
  const all = await db.records.toArray()
  return all.sort((a, b) => new Date(b.service_date) - new Date(a.service_date))
}

// ── Sync Engine ───────────────────────────────────────────────

/**
 * Push any unsynced local records to Supabase.
 * Safe to call at any time — silently skips if offline.
 */
export async function flushPendingRecords() {
  if (!navigator.onLine) return

  const pending = await db.records.where('synced').equals(0).toArray()
  if (!pending.length) return

  for (const record of pending) {
    const { localId, synced, ...supabaseRecord } = record

    const { data, error } = await supabase
      .from('maintenance_records')
      .insert(supabaseRecord)
      .select()
      .single()

    if (!error && data) {
      // Mark as synced in local DB
      await db.records.update(localId, { synced: 1, id: data.id })
    }
  }
}

/**
 * Pull all maintenance records from Supabase into local cache.
 * Call this on login or when coming back online.
 */
export async function syncRecordsFromSupabase() {
  const { data, error } = await supabase
    .from('maintenance_records')
    .select('*')
    .order('service_date', { ascending: false })

  if (error || !data) return

  // Merge into local DB (don't overwrite unsynced local records)
  for (const record of data) {
    const existing = await db.records.where('id').equals(record.id).first()
    if (!existing) {
      await db.records.add({ ...record, synced: 1 })
    }
  }
}

// ── Connectivity listeners ────────────────────────────────────
// Automatically flush the queue whenever the device comes back online.

window.addEventListener('online', () => {
  console.log('[sync] Back online — flushing pending records')
  flushPendingRecords()
})
