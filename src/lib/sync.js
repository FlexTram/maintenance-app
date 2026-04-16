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
 * Sort a list of equipment naturally: TRAM-01..TRAM-32 first (numeric),
 * then ADA-01, ADA-02. Retired trams fall to the end.
 */
export function sortTrams(list) {
  return [...list].sort((a, b) => {
    const aRetired = a.status === 'retired' ? 1 : 0
    const bRetired = b.status === 'retired' ? 1 : 0
    if (aRetired !== bRetired) return aRetired - bRetired

    const aIsAda = a.tram_number?.startsWith('ADA') ? 1 : 0
    const bIsAda = b.tram_number?.startsWith('ADA') ? 1 : 0
    if (aIsAda !== bIsAda) return aIsAda - bIsAda

    const aNum = parseInt(a.tram_number?.replace(/\D/g, '') || '999', 10)
    const bNum = parseInt(b.tram_number?.replace(/\D/g, '') || '999', 10)
    return aNum - bNum
  })
}

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
  const v = value.trim().toLowerCase()

  // Try local cache — exact match first, then partial
  const all = await db.equipment.toArray()
  const exact = all.find(e =>
    e.tram_number?.toLowerCase() === v ||
    e.serial_number?.toLowerCase() === v ||
    e.qr_id?.toLowerCase() === v ||
    e.name?.toLowerCase() === v
  )
  if (exact) return [exact]

  // Partial match on local cache
  const partial = all.filter(e =>
    e.tram_number?.toLowerCase().includes(v) ||
    e.serial_number?.toLowerCase().includes(v) ||
    e.qr_id?.toLowerCase().includes(v) ||
    e.name?.toLowerCase().includes(v)
  )
  if (partial.length) return partial

  // Fall back to Supabase — partial match with ilike %value%
  const pattern = `%${v}%`
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .or(`tram_number.ilike.${pattern},serial_number.ilike.${pattern},qr_id.ilike.${pattern},name.ilike.${pattern}`)
    .limit(10)

  if (error) { console.error('[sync] getEquipmentByIdentifier failed:', error.message); return null }
  if (!data?.length) return null
  for (const eq of data) await db.equipment.put(eq)
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
  const result = await flushPendingRecords()

  // Check if this record synced
  const updated = await db.records.get(localId)
  const didSync = updated?.synced === 1

  // Return the updated record so callers see the Supabase-assigned id after sync
  return { ...(updated || localRecord), localId, didSync, syncResult: result }
}

/**
 * Get all records for a given equipment ID.
 * Syncs from Supabase first if online to pick up voided flags.
 */
export async function getRecordsForEquipment(equipmentId) {
  if (navigator.onLine) {
    try {
      const { data } = await supabase
        .from('maintenance_records')
        .select('*')
        .eq('equipment_id', equipmentId)
        .order('service_date', { ascending: false })
      if (data) {
        for (const rec of data) {
          const existing = await db.records.where('id').equals(rec.id).first()
          if (existing) {
            await db.records.update(existing.localId, { ...rec, localId: existing.localId, synced: 1 })
          } else {
            await db.records.put({ ...rec, synced: 1 })
          }
        }
      }
    } catch (e) {
      console.error('[sync] Failed to refresh records for equipment:', e.message)
    }
  }
  return db.records
    .where('equipment_id')
    .equals(equipmentId)
    .reverse()
    .sortBy('service_date')
}

/**
 * Get all records from local cache, newest first.
 * Syncs from Supabase first if online to pick up voided flags
 * and records created on other devices.
 */
export async function getAllRecords() {
  if (navigator.onLine) {
    try {
      const { data } = await supabase
        .from('maintenance_records')
        .select('*')
        .order('service_date', { ascending: false })
      if (data) {
        for (const rec of data) {
          const existing = await db.records.where('id').equals(rec.id).first()
          if (existing) {
            await db.records.update(existing.localId, { ...rec, localId: existing.localId, synced: 1 })
          } else {
            await db.records.put({ ...rec, synced: 1 })
          }
        }
      }
    } catch (e) {
      console.error('[sync] Failed to refresh records from Supabase:', e.message)
    }
  }
  const all = await db.records.toArray()
  return all.sort((a, b) => new Date(b.service_date) - new Date(a.service_date))
}

// ── Events & Deployments ──────────────────────────────────────

/**
 * Get all events. Syncs from Supabase if online, falls back to local cache.
 */
export async function getAllEvents() {
  if (navigator.onLine) {
    try {
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: false })
      if (data) {
        await db.events.clear()
        await db.events.bulkPut(data)
      }
    } catch (e) {
      console.error('[sync] Failed to refresh events:', e.message)
    }
  }
  return db.events.orderBy('start_date').reverse().toArray()
}

/**
 * Get all deployments (active + returned). Syncs from Supabase if online.
 */
export async function getAllDeployments() {
  if (navigator.onLine) {
    try {
      const { data } = await supabase
        .from('deployments')
        .select('*')
      if (data) {
        await db.deployments.clear()
        await db.deployments.bulkPut(data)
      }
    } catch (e) {
      console.error('[sync] Failed to refresh deployments:', e.message)
    }
  }
  return db.deployments.toArray()
}

/**
 * Mark a deployment as returned once a pick-up record has been created.
 * Writes to Supabase and refreshes the local cache.
 */
export async function markDeploymentReturned(deploymentId, pickUpRecordId, pickedUpAt) {
  const { error } = await supabase
    .from('deployments')
    .update({
      pick_up_record_id: pickUpRecordId,
      picked_up_at: pickedUpAt,
      status: 'returned',
    })
    .eq('id', deploymentId)
  if (error) {
    console.error('[sync] Failed to mark deployment returned:', error.message)
    return false
  }
  // Refresh local cache so master list updates immediately
  await getAllDeployments()
  return true
}

/**
 * Close an event: set status='completed' and closed_at=now.
 * Used when all trams in an event have been picked up OR the tech manually closes.
 */
export async function closeEvent(eventId) {
  const { error } = await supabase
    .from('events')
    .update({ status: 'completed', closed_at: new Date().toISOString() })
    .eq('id', eventId)
  if (error) {
    console.error('[sync] Failed to close event:', error.message)
    return false
  }
  await getAllEvents()
  return true
}

/**
 * Check if an event has any still-deployed trams. Returns true if all returned.
 */
export async function areAllDeploymentsReturned(eventId) {
  const { count, error } = await supabase
    .from('deployments')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'deployed')
  if (error) {
    console.error('[sync] Failed to count open deployments:', error.message)
    return false
  }
  return count === 0
}

/**
 * Load the full deployments-with-events list for the pick-up form.
 * Returns events (active only) each with their deployed trams.
 */
export async function getActiveEventsWithDeployments() {
  const [events, deployments, equip] = await Promise.all([
    getAllEvents(), getAllDeployments(), getAllEquipment()
  ])
  const eqMap = Object.fromEntries(equip.map(e => [e.id, e]))
  return events
    .filter(e => e.status === 'active')
    .map(event => ({
      ...event,
      deployments: deployments
        .filter(d => d.event_id === event.id && d.status === 'deployed')
        .map(d => ({ ...d, equipment: eqMap[d.equipment_id] })),
    }))
    .filter(e => e.deployments.length > 0)
}

/**
 * Get a map of equipmentId -> active deployment (joined with event details).
 * Used by the master list to show "where is this tram right now".
 */
export async function getActiveDeploymentMap() {
  const [deployments, events] = await Promise.all([getAllDeployments(), getAllEvents()])
  const eventMap = Object.fromEntries(events.map(e => [e.id, e]))
  const map = {}
  for (const d of deployments) {
    if (d.status !== 'deployed') continue
    const event = eventMap[d.event_id]
    if (!event) continue
    map[d.equipment_id] = {
      ...d,
      event_name:       event.name,
      event_location:   event.location,
      event_client:     event.client,
      event_start_date: event.start_date,
    }
  }
  return map
}

// ── Sync Engine ───────────────────────────────────────────────

/**
 * Push any unsynced local records to Supabase.
 * Safe to call at any time — silently skips if offline.
 */
export async function flushPendingRecords() {
  if (!navigator.onLine) return { synced: 0, failed: 0, pending: 0 }

  // Try indexed query first, then fall back to full scan for records missing the synced index
  let pending = await db.records.where('synced').equals(0).toArray()
  if (!pending.length) {
    const all = await db.records.toArray()
    pending = all.filter(r => !r.synced || r.synced === 0)
  }
  if (!pending.length) return { synced: 0, failed: 0, pending: 0 }
  console.log(`[sync] Flushing ${pending.length} pending records...`)

  let synced = 0, failed = 0
  await Promise.all(pending.map(async record => {
    // Only send columns that exist in the maintenance_records table
    // Skip id — let Supabase generate it to avoid invalid UUID errors
    const supabaseRecord = {
      equipment_id: record.equipment_id,
      technician_name: record.technician_name,
      service_date: record.service_date,
      status: record.status,
      inspection_notes: record.inspection_notes || null,
      parts_replaced: record.parts_replaced || null,
      created_by: record.created_by || null,
      record_type: record.record_type || null,
      form_data: record.form_data || null,
    }

    const { data, error } = await supabase
      .from('maintenance_records')
      .insert(supabaseRecord)
      .select()
      .single()

    if (error) {
      console.error('[sync] Failed to sync record:', error.message)
      failed++
      await db.syncErrors.add({
        record_id: record.id,
        local_id: record.localId,
        equipment_id: record.equipment_id,
        error_message: error.message,
        failed_at: new Date().toISOString(),
      })
    } else if (data) {
      await db.records.update(record.localId, { synced: 1, id: data.id })
      synced++
    }
  }))
  console.log(`[sync] Done: ${synced} synced, ${failed} failed`)

  // Stash last sync result for homepage status display
  try {
    localStorage.setItem('last_sync_result', JSON.stringify({
      synced, failed, attempted: pending.length, at: new Date().toISOString(),
    }))
  } catch {}

  return { synced, failed, pending: pending.length }
}

/**
 * Get the last sync result recorded on this device, or null if none.
 */
export function getLastSyncResult() {
  try {
    const raw = localStorage.getItem('last_sync_result')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Total record count in the local IndexedDB (all states combined).
 */
export async function getLocalRecordCount() {
  return db.records.count()
}

/**
 * Get count of pending (unsynced) records.
 */
export async function getPendingCount() {
  let count = await db.records.where('synced').equals(0).count()
  if (count === 0) {
    const all = await db.records.toArray()
    count = all.filter(r => !r.synced || r.synced === 0).length
  }
  return count
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
    } else if (existing.synced === 1) {
      // Refresh synced records so edits/voids propagate across devices
      await db.records.update(existing.localId, { ...record, synced: 1 })
    }
  }
}

// ── Void Records ─────────────────────────────────────────────

/**
 * Void a maintenance record. The record stays in the database
 * but is flagged as voided with a reason, timestamp, and user.
 */
export async function voidRecord(localId, supabaseId, reason, userId) {
  const now = new Date().toISOString()

  // Update locally
  await db.records.update(localId, {
    voided: true,
    voided_reason: reason,
    voided_at: now,
    voided_by: userId,
  })

  // Sync to Supabase if online and record has a Supabase ID
  if (navigator.onLine && supabaseId) {
    const { error } = await supabase
      .from('maintenance_records')
      .update({ voided: true, voided_reason: reason, voided_at: now, voided_by: userId })
      .eq('id', supabaseId)

    if (error) {
      console.error('[sync] Failed to void record in Supabase:', error.message)
    }
  }
}

// ── Edit Records ─────────────────────────────────────────────

/**
 * Edit a maintenance record. Updates the record fields and stamps
 * who edited and when, following the same offline-first pattern as voidRecord.
 */
export async function editRecord(localId, supabaseId, updatedFields, userId, userName) {
  const now = new Date().toISOString()

  const payload = {
    ...updatedFields,
    edited_by: userId,
    edited_at: now,
    edited_by_name: userName,
  }

  // Update locally first (offline-safe)
  await db.records.update(localId, payload)

  // Sync to Supabase if online and record has a Supabase ID
  if (navigator.onLine && supabaseId) {
    // Strip any IndexedDB-only fields before sending to Supabase
    const { localId: _lid, synced: _s, created_at: _ca, ...supabasePayload } = payload

    const { error } = await supabase
      .from('maintenance_records')
      .update(supabasePayload)
      .eq('id', supabaseId)

    if (error) {
      console.error('[sync] Failed to edit record in Supabase:', error.message)
    }
  }
}

// ── Equipment Status ──────────────────────────────────────────

/**
 * Update the operational status of a piece of equipment.
 * Writes to IndexedDB immediately (offline-safe), then syncs to Supabase.
 * Also inserts a status_changes row for the audit trail.
 */
export async function updateEquipmentStatus(equipmentId, newStatus, note, userId, userName) {
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
      .insert({ equipment_id: equipmentId, old_status: oldStatus, new_status: newStatus, note, changed_by: userId, changed_by_name: userName })
  }
}

// ── Void Status Changes ─────────────────────────────────────

/**
 * Void a status change entry. The record stays in the database
 * but is flagged as voided with a reason, timestamp, and user.
 */
export async function voidStatusChange(statusChangeId, reason, userId) {
  const now = new Date().toISOString()

  // Fetch the status change being voided to get equipment_id
  const { data: sc } = await supabase
    .from('status_changes')
    .select('equipment_id')
    .eq('id', statusChangeId)
    .single()

  const { error } = await supabase
    .from('status_changes')
    .update({ voided: true, voided_reason: reason, voided_at: now, voided_by: userId })
    .eq('id', statusChangeId)

  if (error) {
    console.error('[sync] Failed to void status change in Supabase:', error.message)
    throw error
  }

  // Revert equipment status to the most recent non-voided status change
  if (sc?.equipment_id) {
    const { data: latest } = await supabase
      .from('status_changes')
      .select('new_status')
      .eq('equipment_id', sc.equipment_id)
      .or('voided.is.null,voided.eq.false')
      .order('changed_at', { ascending: false })
      .limit(1)
      .single()

    const revertStatus = latest?.new_status || 'in_service'

    await supabase
      .from('equipment')
      .update({ status: revertStatus, status_updated_at: now, status_updated_by: userId })
      .eq('id', sc.equipment_id)

    // Update local IndexedDB too
    await db.equipment.update(sc.equipment_id, {
      status: revertStatus,
      status_updated_at: now,
      status_updated_by: userId,
    })

    return { revertStatus }
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

/**
 * Fetch all status changes across the fleet.
 */
export async function getAllStatusChanges() {
  const { data, error } = await supabase
    .from('status_changes')
    .select('*')
    .order('changed_at', { ascending: false })
  if (error) {
    console.error('Failed to fetch all status changes:', error)
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
