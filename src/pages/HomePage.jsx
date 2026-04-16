import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getAllRecords, getAllEquipment, voidRecord, getPendingCount, flushPendingRecords, getLastSyncResult, getLocalRecordCount } from '../lib/sync'

export default function HomePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [recent,    setRecent]    = useState([])
  const [stats,     setStats]     = useState({ inService: 0, outOfService: 0, pending: 0 })
  const [pendingSync, setPendingSync] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [lastSync, setLastSync] = useState(getLastSyncResult())
  const [localCount, setLocalCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [recs, equip] = await Promise.all([getAllRecords(), getAllEquipment()])
      if (cancelled) return

      let inService = 0, outOfService = 0, pending = 0
      equip.forEach(e => {
        if (e.status === 'retired') return // exclude retired from all counts
        if (e.status === 'out_of_service') outOfService++
        else if (e.status === 'pending') pending++
        else inService++
      })
      setStats({ inService, outOfService, pending })

      const seen = new Set()
      const recentEquip = []
      for (const r of recs) {
        if (r.voided) continue
        if (!seen.has(r.equipment_id)) {
          seen.add(r.equipment_id)
          const eq = equip.find(e => e.id === r.equipment_id)
          if (eq) recentEquip.push({ eq, lastRecord: r })
        }
        if (recentEquip.length >= 4) break
      }
      setRecent(recentEquip)

      // Check for unsynced records
      const unsyncedCount = await getPendingCount()
      setPendingSync(unsyncedCount)
      setLocalCount(await getLocalRecordCount())
    }
    load()
    return () => { cancelled = true }
  }, [user])

  async function handleManualSync() {
    setSyncing(true)
    setSyncResult(null)
    const result = await flushPendingRecords()
    const remaining = await getPendingCount()
    setPendingSync(remaining)
    setSyncResult(result)
    setLastSync(getLastSyncResult())
    setLocalCount(await getLocalRecordCount())
    setSyncing(false)
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0f1a', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#0a0f1a', padding: '18px 20px 14px', borderBottom: '0.5px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/icons/icon-192.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Flextram" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.3px' }}>FLEXTRAM</div>
            <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Maintenance</div>
          </div>
        </div>
        <button onClick={signOut} style={{ fontSize: 12, color: '#475569', border: '0.5px solid #1e293b', borderRadius: 6, padding: '5px 10px', background: 'transparent', cursor: 'pointer', width: 'auto' }}>
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 20px' }}>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#f1f5f9', marginBottom: 2 }}>Hi, {firstName}</div>
          <div style={{ fontSize: 13, color: '#475569' }}>Here's your equipment overview</div>
        </div>

        {pendingSync > 0 && (
          <div style={{ background: '#431407', border: '1px solid #f59e0b', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fb923c', marginBottom: 6 }}>
              {pendingSync} record{pendingSync > 1 ? 's' : ''} waiting to sync
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
              These records are saved on your device but haven't been uploaded to the cloud yet.
            </div>
            {syncResult && syncResult.failed > 0 && (
              <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>
                {syncResult.failed} record{syncResult.failed > 1 ? 's' : ''} failed to sync. Try again or contact your admin.
              </div>
            )}
            {syncResult && syncResult.synced > 0 && (
              <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 8 }}>
                {syncResult.synced} record{syncResult.synced > 1 ? 's' : ''} synced successfully!
              </div>
            )}
            <button
              onClick={handleManualSync}
              disabled={syncing}
              style={{ width: '100%', padding: 10, fontSize: 14, fontWeight: 700, background: '#f59e0b', color: '#0a0f1a', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: syncing ? 0.5 : 1 }}
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <a href="/recover.html" style={{ display: 'block', textAlign: 'center', fontSize: 12, color: '#64748b', marginTop: 8 }}>
              Advanced recovery
            </a>
          </div>
        )}

        {/* Sync status strip — visible whenever there are local records */}
        {localCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', marginBottom: 14,
            background: '#0f172a', border: '0.5px solid #1e293b', borderRadius: 8,
            fontSize: 11, color: '#64748b',
          }}>
            <span>
              {localCount} record{localCount !== 1 ? 's' : ''} on this device
              {pendingSync > 0 && <span style={{ color: '#fb923c', fontWeight: 600 }}> · {pendingSync} pending</span>}
            </span>
            <span>
              {lastSync ? (
                <>
                  Last push: {lastSync.synced}
                  {lastSync.failed > 0 && <span style={{ color: '#f87171' }}> ({lastSync.failed} failed)</span>}
                  {' · '}
                  {new Date(lastSync.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </>
              ) : 'No sync yet'}
            </span>
          </div>
        )}

        <img
          src="/heavy_repairs_homepage.png"
          alt="Heavy Repairs"
          style={{ width: '100%', borderRadius: 10, marginBottom: 10, display: 'block', paddingTop: 5, paddingBottom: 5 }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div className="stat-card in-service" role="button" tabIndex="0" aria-label={`${stats.inService} trams in service`}
            onClick={() => navigate('/records?filter=in_service&view=equipment')}
            onKeyDown={e => e.key === 'Enter' && navigate('/records?filter=in_service&view=equipment')}
            onPointerDown={e => e.currentTarget.classList.add('active')}
            onPointerUp={e => e.currentTarget.classList.remove('active')}
            onPointerLeave={e => e.currentTarget.classList.remove('active')}
          >
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>In service</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#4ade80' }}>{stats.inService}</div>
          </div>
          <div className="stat-card out-of-service" role="button" tabIndex="0" aria-label={`${stats.outOfService} trams out of service`}
            onClick={() => navigate('/records?filter=out_of_service&view=equipment')}
            onKeyDown={e => e.key === 'Enter' && navigate('/records?filter=out_of_service&view=equipment')}
            onPointerDown={e => e.currentTarget.classList.add('active')}
            onPointerUp={e => e.currentTarget.classList.remove('active')}
            onPointerLeave={e => e.currentTarget.classList.remove('active')}
          >
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Out of service</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#f87171' }}>{stats.outOfService}</div>
          </div>
          <div className="stat-card pending" role="button" tabIndex="0" aria-label={`${stats.pending} trams pending`}
            onClick={() => navigate('/records?filter=pending&view=equipment')}
            onKeyDown={e => e.key === 'Enter' && navigate('/records?filter=pending&view=equipment')}
            onPointerDown={e => e.currentTarget.classList.add('active')}
            onPointerUp={e => e.currentTarget.classList.remove('active')}
            onPointerLeave={e => e.currentTarget.classList.remove('active')}
          >
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#fb923c' }}>{stats.pending}</div>
          </div>
        </div>

        <button
          onClick={() => navigate('/scan')}
          style={{ width: '100%', background: '#f59e0b', color: '#0a0f1a', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 700, marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          Scan QR Code or Enter Serial # Manually
        </button>

        <button
          onClick={() => navigate('/dropoff')}
          style={{ width: '100%', background: 'transparent', color: '#94a3b8', border: '0.5px solid #1e293b', borderRadius: 10, padding: 11, fontSize: 14, marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2" ry="2" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
          Log Drop-Off
        </button>

        <button
          onClick={() => navigate('/pickup')}
          style={{ width: '100%', background: 'transparent', color: '#94a3b8', border: '0.5px solid #1e293b', borderRadius: 10, padding: 11, fontSize: 14, marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 16V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10" />
            <polygon points="3 16 8 16 11 19 13 19 16 16 21 16 21 21 3 21 3 16" />
            <path d="M12 11l-3-3 3-3" /><path d="M9 8h8" />
          </svg>
          Log Pick-Up
        </button>

        <button
          onClick={() => navigate('/records?view=records')}
          style={{ width: '100%', background: 'transparent', color: '#94a3b8', border: '0.5px solid #1e293b', borderRadius: 10, padding: 11, fontSize: 14, marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 12h6" /><path d="M9 16h6" />
          </svg>
          View all records
        </button>

        <button
          onClick={() => navigate('/docs')}
          style={{ width: '100%', background: 'transparent', color: '#94a3b8', border: '0.5px solid #1e293b', borderRadius: 10, padding: 11, fontSize: 14, marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Quick Document Reference
        </button>

        {recent.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#334155', marginBottom: 10 }}>
              Recently serviced
            </div>
            {recent.map(({ eq, lastRecord }) => (
              <RecentCard key={eq.id} eq={eq} lastRecord={lastRecord} navigate={navigate} user={user} setRecent={setRecent} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function RecentCard({ eq, lastRecord, navigate, user, setRecent }) {
  const [showVoid, setShowVoid] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  async function handleVoid() {
    if (!voidReason.trim()) return
    setVoiding(true)
    await voidRecord(lastRecord.localId, lastRecord.id, voidReason.trim(), user?.id)
    setRecent(prev => prev.filter(r => r.lastRecord.id !== lastRecord.id && r.lastRecord.localId !== lastRecord.localId))
    setVoiding(false)
  }

  return (
    <div style={{ border: '0.5px solid #1e293b', borderRadius: 10, padding: 12, marginBottom: 7, background: '#0f172a' }}>
      <div
        role="button" tabIndex="0" aria-label={`View ${eq.name}`}
        onClick={() => !showVoid && navigate(`/equipment/${eq.id}`)}
        onKeyDown={e => e.key === 'Enter' && !showVoid && navigate(`/equipment/${eq.id}`)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
      >
        <div style={{ width: 36, height: 36, background: '#1e293b', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }} aria-hidden="true">
          {eq.icon || '⚙️'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{eq.name}</div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            {eq.serial_number || eq.qr_id} · {new Date(lastRecord.service_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <StatusBadge status={lastRecord.status} />
          {!showVoid && (
            <button
              onClick={e => { e.stopPropagation(); setShowVoid(true); setVoidReason('') }}
              style={{ fontSize: 10, color: '#f87171', background: 'transparent', border: '1px solid #450a0a', borderRadius: 6, cursor: 'pointer', padding: '3px 10px', fontWeight: 600 }}
            >
              Void Record
            </button>
          )}
        </div>
      </div>
      {showVoid && (
        <div style={{ marginTop: 8, padding: '8px 10px', background: '#1e293b', borderRadius: 6, border: '1px solid #334155' }}>
          <textarea
            placeholder="Reason for voiding…"
            value={voidReason}
            onChange={e => setVoidReason(e.target.value)}
            rows={2}
            style={{ width: '100%', fontSize: 13, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: 8, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              disabled={!voidReason.trim() || voiding}
              onClick={handleVoid}
              style={{ flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#ef4444', color: '#fff', opacity: !voidReason.trim() || voiding ? 0.4 : 1 }}
            >
              {voiding ? 'Voiding…' : 'Confirm Void'}
            </button>
            <button
              onClick={() => { setShowVoid(false); setVoidReason('') }}
              style={{ flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function StatusBadge({ status }) {
  const styles = {
    in_service:     { background: '#052e16', color: '#4ade80', label: 'In service' },
    out_of_service: { background: '#450a0a', color: '#f87171', label: 'Out of service' },
    pending:        { background: '#431407', color: '#fb923c', label: 'Pending' },
  }
  const s = styles[status] || { background: '#1e293b', color: '#94a3b8', label: status }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: s.background, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}
