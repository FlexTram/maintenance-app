import Dexie from 'dexie'

// Local IndexedDB database — stores records offline until they can sync.
export const db = new Dexie('MaintenanceApp')

db.version(1).stores({
  // Equipment cache — synced from Supabase on login, used offline
  equipment: 'id, qr_id',

  // Maintenance records — written locally immediately, synced when online
  // `synced` flag: 0 = pending upload, 1 = confirmed in Supabase
  records: '++localId, id, equipment_id, synced, service_date',
})

db.version(2).stores({
  equipment: 'id, qr_id',
  records: '++localId, id, equipment_id, synced, service_date',
  // Sync error log — records failed Supabase upload attempts
  syncErrors: '++id, record_id, failed_at',
})

db.version(3).stores({
  equipment: 'id, qr_id',
  records: '++localId, id, equipment_id, synced, service_date',
  syncErrors: '++id, record_id, failed_at',
  // Event + deployment caches — synced from Supabase, used offline for master list
  events: 'id, start_date, status',
  deployments: 'id, equipment_id, event_id, status',
})
