import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAllRecords, getAllEquipment, getAllStatusChanges, getActiveDeploymentMap, sortTrams } from '../lib/sync'
import { StatusBadge } from './HomePage'

function DropOffGroupCard({ group, equipment, navigate }) {
  const [expanded, setExpanded] = useState(false)
  const color = '#4ade80'
  const bg = '#1a2e1a'
  const date = group.event_date
    ? new Date(group.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''
  const tramCount = group.records.length
  const damageCount = group.records.reduce((n, r) => {
    const conds = r.form_data?.conditions || {}
    return n + Object.values(conds).filter(c => c?.status === 'damage').length
  }, 0)
  const photoCount = group.records.reduce((n, r) => {
    const photos = r.form_data?.photos || {}
    return n + Object.values(photos).reduce((m, arr) => m + (arr?.length || 0), 0)
  }, 0)

  return (
    <div
      role="button" tabIndex="0" aria-expanded={expanded} aria-label={`Drop-Off event ${group.event_name}`}
      onClick={() => setExpanded(!expanded)}
      onKeyDown={(e) => { if (e.key === 'Enter') setExpanded(!expanded) }}
      style={{
        border: `1px solid ${color}40`, borderRadius: 8, padding: '10px 12px',
        marginBottom: 8, background: bg, cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4, background: `${color}20`, color }}>
            Drop-Off
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {group.event_name || 'Untitled event'}
          </span>
        </div>
        <span aria-hidden="true" style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>
          {expanded ? '▾' : '▸'} {tramCount}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
        {group.event_location && <span>{group.event_location} · </span>}
        {date} · {tramCount} tram{tramCount !== 1 ? 's' : ''}
        {damageCount > 0 && <span style={{ color: '#f87171' }}> · {damageCount} damage</span>}
        {photoCount > 0 && <span> · {photoCount} photo{photoCount !== 1 ? 's' : ''}</span>}
      </div>

      {expanded && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${color}20`, paddingTop: 8 }}>
          {group.records.map(r => {
            const eq = equipment[r.equipment_id]
            const conds = r.form_data?.conditions || {}
            const tramDamage = Object.values(conds).filter(c => c?.status === 'damage').length
            return (
              <div
                key={r.id || r.localId}
                onClick={(e) => { e.stopPropagation(); eq && navigate(`/equipment/${eq.id}`) }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '0.5px solid rgba(74,222,128,0.1)' }}
              >
                <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{eq?.name || 'Unknown'}</span>
                <span style={{ fontSize: 11, color: tramDamage > 0 ? '#f87171' : '#4ade80' }}>
                  {tramDamage > 0 ? `${tramDamage} damage` : 'All good'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusGroupCardFleet({ eq, changes, navigate, color, bg, latestDate, statusLabel, statusColor }) {
  const [expanded, setExpanded] = useState(false)
  const latest = changes[0]

  return (
    <div
      role="button" tabIndex="0" aria-expanded={expanded} aria-label={`Status changes for ${eq?.name || 'Unknown'}`}
      onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setExpanded(!expanded) } }}
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
        <span aria-hidden="true" style={{ fontSize: 10, color: '#64748b' }}>{expanded ? '▾' : '▸'} {changes.length > 1 ? `${changes.length}` : ''}</span>
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
                <span aria-hidden="true" style={{ color: '#64748b' }}>→</span>
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
  const [deployMap, setDeployMap] = useState({})
  const [filter,    setFilter]    = useState(searchParams.get('filter') || 'all')
  const [view]                    = useState(searchParams.get('view') || 'equipment')
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [recs, equip, statusChanges, deployments] = await Promise.all([
        getAllRecords(), getAllEquipment(), getAllStatusChanges(), getActiveDeploymentMap()
      ])
      setDeployMap(deployments)
      const eqMap = Object.fromEntries(equip.map(e => [e.id, e]))
      setEquipment(eqMap)
      setEquipList(equip)
      setRecords(recs)

      // Build merged timeline — collapse status changes per equipment into group cards
      const scByEquip = {}
      for (const sc of statusChanges) {
        if (sc.voided) continue
        if (!scByEquip[sc.equipment_id]) scByEquip[sc.equipment_id] = []
        scByEquip[sc.equipment_id].push(sc)
      }
      const scGroups = Object.entries(scByEquip).map(([eqId, changes]) => ({
        _type: 'status_group',
        equipment_id: eqId,
        _sortDate: changes[0]?.changed_at?.split('T')[0] || changes[0]?.changed_at,
        changes,
      }))

      // Group drop-off records by event_name + event_date
      const dropoffGroups = {}
      const otherRecords = []
      for (const r of recs) {
        if (r.voided) continue
        if (r.record_type === 'dropoff') {
          const evName = r.form_data?.event_name || 'Untitled'
          const evDate = r.form_data?.event_date || r.service_date
          const key = `${evName}__${evDate}`
          if (!dropoffGroups[key]) {
            dropoffGroups[key] = {
              _type: 'dropoff_group',
              _sortDate: evDate,
              event_name: evName,
              event_location: r.form_data?.event_location || '',
              event_date: evDate,
              records: [],
            }
          }
          dropoffGroups[key].records.push(r)
        } else {
          otherRecords.push({ ...r, _type: 'record', _sortDate: r.service_date })
        }
      }

      const merged = [
        ...otherRecords,
        ...Object.values(dropoffGroups),
        ...scGroups,
      ].sort((a, b) => (b._sortDate || '').localeCompare(a._sortDate || ''))
      setTimeline(merged)

      setLoading(false)
    }
    load()
  }, [])

  const activeEquip = equipList.filter(e => e.status !== 'retired')
  const filteredEquip = sortTrams(filter === 'all'
    ? activeEquip
    : activeEquip.filter(e => {
        if (filter === 'deployed')   return !!deployMap[e.id]
        if (filter === 'in_service') return !e.status || e.status === 'in_service'
        return e.status === filter
      }))

  // Filter timeline by equipment's CURRENT status, not the record's status at time of submission
  const matchesFilter = (eqId) => {
    if (!eqId) return false
    if (filter === 'deployed') return !!deployMap[eqId]
    const eq = equipment[eqId]
    if (!eq) return false
    const eqStatus = eq.status || 'in_service'
    if (filter === 'in_service') return eqStatus === 'in_service'
    return eqStatus === filter
  }
  const filteredTimeline = filter === 'all'
    ? timeline
    : timeline.filter(entry => {
        if (entry._type === 'dropoff_group') {
          return entry.records.some(r => matchesFilter(r.equipment_id))
        }
        return matchesFilter(entry.equipment_id)
      })

  const statusLabel = f =>
    f === 'all' ? 'All'
    : f === 'in_service' ? 'In service'
    : f === 'out_of_service' ? 'Out of service'
    : f === 'deployed' ? 'Deployed'
    : 'Pending'

  const filterColors = {
    all:            { bg: '#1e293b', color: '#f1f5f9', border: '#f1f5f9' },
    in_service:     { bg: '#052e16', color: '#4ade80', border: '#4ade80' },
    out_of_service: { bg: '#450a0a', color: '#f87171', border: '#f87171' },
    pending:        { bg: '#431407', color: '#fb923c', border: '#fb923c' },
    deployed:       { bg: '#1a2e1a', color: '#4ade80', border: '#4ade80' },
  }

  const deployedCount = Object.keys(deployMap).length

  return (
    <div className="page">
      <button className="back" onClick={() => navigate('/')}>← Home</button>
      <div style={{ fontWeight: 600, fontSize: 18, marginBottom: '1rem' }}>
        {view === 'records' ? 'All records' : 'Fleet Equipment'}
      </div>

      {/* Filter tabs */}
      <div role="tablist" aria-label="Filter by status" style={{ display: 'flex', gap: 6, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['all', 'deployed', 'in_service', 'out_of_service', 'pending'].map(f => {
          const active = filter === f
          const c = filterColors[f]
          return (
            <button
              key={f}
              role="tab" aria-selected={active}
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
          {filteredEquip.map(eq => {
            const deployment = deployMap[eq.id]
            return (
              <div
                key={eq.id}
                className="record"
                role="button" tabIndex="0" aria-label={`View ${eq.name}`}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/equipment/${eq.id}`)}
                onKeyDown={e => e.key === 'Enter' && navigate(`/equipment/${eq.id}`)}
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
                {deployment && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    marginTop: 6, padding: '4px 10px',
                    background: '#1a2e1a', border: '0.5px solid #4ade8040',
                    borderRadius: 999, fontSize: 12, color: '#4ade80', fontWeight: 600,
                  }}>
                    📍 {deployment.event_name}
                    {deployment.event_location && <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {deployment.event_location}</span>}
                  </div>
                )}
                {eq.status_note && (
                  <div className="record-notes">{eq.status_note}</div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* Records view — merged timeline of maintenance records + status changes */}
      {!loading && view === 'records' && (
        <>
          {filteredTimeline.length === 0 && (
            <div className="empty">No {filter !== 'all' ? statusLabel(filter).toLowerCase() : ''} records found.</div>
          )}
          {filteredTimeline.map((entry, i) => {
            if (entry._type === 'dropoff_group') {
              return (
                <DropOffGroupCard
                  key={`do-${entry.event_name}-${entry.event_date}`}
                  group={entry}
                  equipment={equipment}
                  navigate={navigate}
                />
              )
            }
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
            const badgeConfig = {
              inspection: { bg: '#1e3a5f', color: '#60a5fa', label: 'Inspection' },
              repair:     { bg: '#5c2d0e', color: '#fb923c', label: 'Repair' },
              dropoff:    { bg: '#1a2e1a', color: '#4ade80', label: 'Drop-Off' },
            }
            const badge = badgeConfig[entry.record_type]
            return (
              <div
                key={entry.localId || entry.id}
                className="record"
                style={{ cursor: eq ? 'pointer' : 'default' }}
                onClick={() => eq && navigate(`/equipment/${eq.id}`)}
              >
                <div className="record-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {badge && (
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4, background: badge.bg, color: badge.color }}>
                        {badge.label}
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
