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
  const cached = await db.equipment.where('qr_id').equals(qrId).first()
  if (cached) return cached

  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('qr_id', qrId)
    .single()

  if (error) { console.error('[sync] getEquipmentByQrId failed:', error.message); return null }
  if (!data) return null
  await db.equipment.put(data)
  return data
}

/**
 * Look up equipment by tram number, serial number, or QR ID.
 * Tries each field in order. Case-insensitive for tram numbers.
 * Used by the manual entry fallback on the scan page.
 */
export async function getEquipmentByIdentifier(value) {
  const v = value.trim()

  // Try local cache across all three fields
  const all = await db.equipment.toArray()
  const match = all.find(e =>
    e.tram_number?.toLowerCase() === v.toLowerCase() ||
    e.serial_number?.toLowerCase() === v.toLowerCase() ||
    e.qr_id?.toLowerCase() === v.toLowerCase()
  )
  if (match) return match

  // Fall back to Supabase
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .or(`tram_number.ilike.${v},serial_number.ilike.${v},qr_id.ilike.${v}`)
    .limit(1)
    .single()

  if (error) { console.error('[sync] getEquipmentByIdentifier failed:', error.message); return null }
  if (!data) return null
  await db.equipment.put(data)
  return data
}

/**
 * Fetch and cache all equipment from Supabase.
 * Called on login so the full list is available offline.
 */
export async function syncEquipmentCache() {
  const { data, error } = await supabase.from('equipment').select('*')
  if (error) { console.error('[sync] syncEquipmentCache failed:', error.message); return }
  if (!data) return

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

    if (error) {
      console.error('[sync] Failed to sync record:', error.message)
    } else if (data) {
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

  if (error) { console.error('[sync] syncRecordsFromSupabase failed:', error.message); return }
  if (!data) return

  // Merge into local DB (don't overwrite unsynced local records)
  for (const record of data) {
    const existing = await db.records.where('id').equals(record.id).first()
    if (!existing) {
      await db.records.add({ ...record, synced: 1 })
    }
  }
}

// ── Equipment Status ──────────────────────────────────────────

/**
 * Update the operational status of a piece of equipment.
 * Writes to IndexedDB immediately (offline-safe), then syncs to Supabase.
 * Also inserts a status_changes row for the audit trail.
 */
export async function updateEquipmentStatus(equipmentId, newStatus, note, userId) {
  const eq = await db.equipment.get(equipmentId)
  const oldStatus = eq?.status || null
  const now = new Date().toISOString()

  // Write locally first — offline-safe
  await db.equipment.update(equipmentId, {
    status:             newStatus,
    status_note:        note,
    status_updated_at:  now,
    status_updated_by:  userId,
  })

  if (navigator.onLine) {
    await supabase
      .from('equipment')
      .update({ status: newStatus, status_note: note, status_updated_at: now, status_updated_by: userId })
      .eq('id', equipmentId)

    await supabase
      .from('status_changes')
      .insert({ equipment_id: equipmentId, old_status: oldStatus, new_status: newStatus, note, changed_by: userId })
  }
}

// ── Status Changes ────────────────────────────────────────────

/**
 * Fetch status change audit trail for a piece of equipment.
 */
export async function getStatusChangesForEquipment(equipmentId) {
  const { data, error } = await supabase
    .from('status_changes')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('changed_at', { ascending: false })
  if (error) {
    console.error('Failed to fetch status changes:', error)
    return []
  }
  return data || []
}

// ── Documents ─────────────────────────────────────────────────

/**
 * Fetch documents for a specific piece of equipment (technical drawings + service procedures).
 */
export async function getDocumentsForEquipment(equipmentId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('category')
  return error ? [] : data
}

/**
 * Fetch fleet-wide global documents (approved tow vehicles + master ops doc).
 */
export async function getGlobalDocuments() {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .is('equipment_id', null)
    .order('category')
  return error ? [] : data
}

// ── Connectivity listeners ────────────────────────────────────
// Automatically flush the queue whenever the device comes back online.

window.addEventListener('online', () => {
  flushPendingRecords()
})
