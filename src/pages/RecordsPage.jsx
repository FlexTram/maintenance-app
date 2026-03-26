import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAllRecords, getAllEquipment, getAllStatusChanges } from '../lib/sync'
import { StatusBadge } from './HomePage'

function StatusGroupCardFleet({ eq, changes, navigate, color, bg, latestDate, statusLabel, statusColor }) {
  const [expanded, setExpanded] = useState(false)
  const latest = changes[0]

  return (
    <div
      onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
      style={{
        border: `1px solid ${color}40`, borderRadius: 8, padding: '8px 12px',
        marginBottom: 8, background: bg, cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4, background: `${color}20`, color }}>
            Status Change
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{eq?.name || 'Unknown'}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color }}>{statusLabel(latest.new_status)}</span>
        </div>
        <span style={{ fontSize: 10, color: '#64748b' }}>{expanded ? '▾' : '▸'} {changes.length > 1 ? `${changes.length}` : ''}</span>
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
        {latest.note && <span>{latest.note} · </span>}
        {latest.changed_by_name && <span>{latest.changed_by_name} · </span>}
        {latestDate}
      </div>

      {expanded && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${color}20`, paddingTop: 8 }}>
          {changes.map((sc, i) => {
            const d = sc.changed_at
              ? new Date(sc.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : ''
            return (
              <div key={sc.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                <span style={{ color: statusColor(sc.old_status) }}>{statusLabel(sc.old_status)}</span>
                <span style={{ color: '#64748b' }}>→</span>
                <span style={{ color: statusColor(sc.new_status) }}>{statusLabel(sc.new_status)}</span>
                {sc.note && <span style={{ color: '#64748b' }}>· {sc.note}</span>}
                {sc.changed_by_name && <span style={{ color: '#475569' }}>· {sc.changed_by_name}</span>}
                <span style={{ color: '#475569' }}>{d}</span>
              </div>
            )
          })}
          <div style={{ marginTop: 6 }}>
            <span onClick={(e) => { e.stopPropagation(); navigate(`/equipment/${eq?.id}`) }}
              style={{ fontSize: 12, color, cursor: 'pointer' }}>
              View equipment →
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RecordsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [records,   setRecords]   = useState([])
  const [timeline,  setTimeline]  = useState([])
  const [equipList, setEquipList] = useState([])
  const [equipment, setEquipment] = useState({})
  const [filter,    setFilter]    = useState(searchParams.get('filter') || 'all')
  const [view]                    = useState(searchParams.get('view') || 'equipment')
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [recs, equip, statusChanges] = await Promise.all([
        getAllRecords(), getAllEquipment(), getAllStatusChanges()
      ])
      const eqMap = Object.fromEntries(equip.map(e => [e.id, e]))
      setEquipment(eqMap)
      setEquipList(equip)
      setRecords(recs)

      // Build merged timeline — collapse status changes per equipment into group cards
      const scByEquip = {}
      for (const sc of statusChanges) {
        if (!scByEquip[sc.equipment_id]) scByEquip[sc.equipment_id] = []
        scByEquip[sc.equipment_id].push(sc)
      }
      const scGroups = Object.entries(scByEquip).map(([eqId, changes]) => ({
        _type: 'status_group',
        equipment_id: eqId,
        _sortDate: changes[0]?.changed_at?.split('T')[0] || changes[0]?.changed_at,
        changes,
      }))
      const merged = [
        ...recs.filter(r => !r.voided).map(r => ({ ...r, _type: 'record', _sortDate: r.service_date })),
        ...scGroups,
      ].sort((a, b) => (b._sortDate || '').localeCompare(a._sortDate || ''))
      setTimeline(merged)

      setLoading(false)
    }
    load()
  }, [])

  // Sort: ADA trams first, then numerically by tram number
  function sortEquipment(list) {
    return [...list].sort((a, b) => {
      const aIsAda = a.tram_number?.startsWith('ADA') ? 0 : 1
      const bIsAda = b.tram_number?.startsWith('ADA') ? 0 : 1
      if (aIsAda !== bIsAda) return aIsAda - bIsAda
      const aNum = parseInt(a.tram_number?.replace(/\D/g, '') || '999')
      const bNum = parseInt(b.tram_number?.replace(/\D/g, '') || '999')
      return aNum - bNum
    })
  }

  const activeEquip = equipList.filter(e => e.status !== 'retired')
  const filteredEquip = sortEquipment(filter === 'all'
    ? activeEquip
    : activeEquip.filter(e => {
        if (filter === 'in_service') return !e.status || e.status === 'in_service'
        return e.status === filter
      }))

  // Filter timeline by equipment's CURRENT status, not the record's status at time of submission
  const filteredTimeline = filter === 'all'
    ? timeline
    : timeline.filter(entry => {
        const eq = equipment[entry.equipment_id]
        if (!eq) return false
        const eqStatus = eq.status || 'in_service'
        if (filter === 'in_service') return eqStatus === 'in_service'
        return eqStatus === filter
      })

  const statusLabel = f =>
    f === 'all' ? 'All' : f === 'in_service' ? 'In service' : f === 'out_of_service' ? 'Out of service' : 'Pending'

  const filterColors = {
    all:            { bg: '#1e293b', color: '#f1f5f9', border: '#f1f5f9' },
    in_service:     { bg: '#052e16', color: '#4ade80', border: '#4ade80' },
    out_of_service: { bg: '#450a0a', color: '#f87171', border: '#f87171' },
    pending:        { bg: '#431407', color: '#fb923c', border: '#fb923c' },
  }

  return (
    <div className="page">
      <button className="back" onClick={() => navigate('/')}>← Home</button>
      <div style={{ fontWeight: 600, fontSize: 18, marginBottom: '1rem' }}>
        {view === 'records' ? 'All records' : 'Fleet Equipment'}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['all', 'in_service', 'out_of_service', 'pending'].map(f => {
          const active = filter === f
          const c = filterColors[f]
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                width: 'auto',
                padding: '6px 14px',
                fontSize: 13,
                background: active ? c.bg : 'var(--bg)',
                color:      active ? c.color : 'var(--text2)',
                borderColor: active ? c.border : 'var(--border)',
                fontWeight: active ? 600 : 400,
              }}
            >
              {statusLabel(f)}
            </button>
          )
        })}
      </div>

      {loading && <div className="empty">Loading…</div>}

      {/* Equipment view (default) */}
      {!loading && view !== 'records' && (
        <>
          {filteredEquip.length === 0 && (
            <div className="empty">No {filter !== 'all' ? statusLabel(filter).toLowerCase() : ''} equipment found.</div>
          )}
          {filteredEquip.map(eq => (
            <div
              key={eq.id}
              className="record"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/equipment/${eq.id}`)}
            >
              <div className="record-header">
                <span style={{ fontWeight: 500, fontSize: 14 }}>
                  {eq.name}{eq.model ? ` — ${eq.model}` : ''}
                </span>
                <StatusBadge status={eq.status || 'in_service'} />
              </div>
              <div className="record-meta">
                {eq.serial_number || eq.qr_id}
                {eq.model_year && <span> · {eq.model_year}</span>}
              </div>
              {eq.status_note && (
                <div className="record-notes">{eq.status_note}</div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Records view — merged timeline of maintenance records + status changes */}
      {!loading && view === 'records' && (
        <>
          {filteredTimeline.length === 0 && (
            <div className="empty">No {filter !== 'all' ? statusLabel(filter).toLowerCase() : ''} records found.</div>
          )}
          {filteredTimeline.map((entry, i) => {
            if (entry._type === 'status_group') {
              const eq = equipment[entry.equipment_id]
              const latest = entry.changes[0]
              const statusLbl = s => (s || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              const statusClr = s => s === 'in_service' ? '#4ade80' : s === 'out_of_service' ? '#f87171' : '#fb923c'
              const statusBgFn = s => s === 'in_service' ? '#052e16' : s === 'out_of_service' ? '#450a0a' : '#431407'
              const color = statusClr(latest.new_status)
              const bg = statusBgFn(latest.new_status)
              const latestDate = latest.changed_at
                ? new Date(latest.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : ''
              return (
                <StatusGroupCardFleet key={`sg-${entry.equipment_id}`}
                  eq={eq} changes={entry.changes} navigate={navigate}
                  color={color} bg={bg} latestDate={latestDate}
                  statusLabel={statusLbl} statusColor={statusClr} />
              )
            }

            const eq = equipment[entry.equipment_id]
            const date = new Date(entry.service_date + 'T12:00:00').toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            })
            const isInspection = entry.record_type === 'inspection'
            return (
              <div
                key={entry.localId || entry.id}
                className="record"
                style={{ cursor: eq ? 'pointer' : 'default' }}
                onClick={() => eq && navigate(`/equipment/${eq.id}`)}
              >
                <div className="record-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {entry.record_type && (
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4, background: isInspection ? '#1e3a5f' : '#5c2d0e', color: isInspection ? '#60a5fa' : '#fb923c' }}>
                        {isInspection ? 'Inspection' : 'Repair'}
                      </span>
                    )}
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{eq?.name || 'Unknown equipment'}</span>
                  </div>
                  <StatusBadge status={entry.status} />
                </div>
                <div className="record-meta">
                  {entry.technician_name} · {date}
                  {entry.synced === 0 && <span className="badge badge-offline" style={{ marginLeft: 8 }}>Pending sync</span>}
                </div>
                {entry.inspection_notes && (
                  <div className="record-notes">{entry.inspection_notes}</div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
