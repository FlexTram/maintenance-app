import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAllRecords, getAllEquipment, getAllStatusChanges } from '../lib/sync'
import { StatusBadge } from './HomePage'

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

      // Build merged timeline for records view
      const merged = [
        ...recs.filter(r => !r.voided).map(r => ({ ...r, _type: 'record', _sortDate: r.service_date })),
        ...statusChanges.map(sc => ({ ...sc, _type: 'status_change', _sortDate: sc.changed_at?.split('T')[0] || sc.changed_at })),
      ].sort((a, b) => (b._sortDate || '').localeCompare(a._sortDate || ''))
      setTimeline(merged)

      setLoading(false)
    }
    load()
  }, [])

  const activeEquip = equipList.filter(e => e.status !== 'retired')
  const filteredEquip = filter === 'all'
    ? activeEquip
    : activeEquip.filter(e => {
        if (filter === 'in_service') return !e.status || e.status === 'in_service'
        return e.status === filter
      })

  const activeRecords = records.filter(r => !r.voided)
  const filteredRecords = filter === 'all' ? activeRecords : activeRecords.filter(r => r.status === filter)

  const statusLabel = f =>
    f === 'all' ? 'All' : f === 'in_service' ? 'In service' : f === 'out_of_service' ? 'Out of service' : 'Pending'

  return (
    <div className="page">
      <button className="back" onClick={() => navigate('/')}>← Home</button>
      <div style={{ fontWeight: 600, fontSize: 18, marginBottom: '1rem' }}>
        {view === 'records' ? 'All records' : 'Fleet Equipment'}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['all', 'in_service', 'out_of_service', 'pending'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              width: 'auto',
              padding: '6px 14px',
              fontSize: 13,
              background: filter === f ? 'var(--accent)' : 'var(--bg)',
              color:      filter === f ? 'var(--bg)'     : 'var(--text2)',
              borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
            }}
          >
            {statusLabel(f)}
          </button>
        ))}
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
          {timeline.length === 0 && (
            <div className="empty">No records found.</div>
          )}
          {timeline.map((entry, i) => {
            if (entry._type === 'status_change') {
              const eq = equipment[entry.equipment_id]
              const date = entry.changed_at
                ? new Date(entry.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Unknown date'
              const statusLbl = s => (s || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              const statusClr = s => s === 'in_service' ? '#4ade80' : s === 'out_of_service' ? '#f87171' : '#fb923c'
              const badgeBg = entry.new_status === 'in_service' ? '#052e16'
                : entry.new_status === 'out_of_service' ? '#450a0a' : '#431407'
              return (
                <div key={`sc-${entry.id || i}`}
                  style={{ borderLeft: `3px solid ${statusClr(entry.new_status)}`, padding: '10px 14px', marginBottom: 8, background: 'var(--surface)', borderRadius: '0 8px 8px 0', cursor: eq ? 'pointer' : 'default' }}
                  onClick={() => eq && navigate(`/equipment/${eq.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4, background: badgeBg, color: statusClr(entry.new_status) }}>
                      Status Change
                    </span>
                    <span style={{ fontWeight: 500 }}>{eq?.name || 'Unknown'}</span>
                    <span style={{ color: statusClr(entry.old_status) }}>{statusLbl(entry.old_status)}</span>
                    <span style={{ color: '#64748b' }}>→</span>
                    <span style={{ color: statusClr(entry.new_status) }}>{statusLbl(entry.new_status)}</span>
                  </div>
                  {entry.note && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>{entry.note}</div>}
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                    {date}
                    {entry.changed_by_name && <span> · {entry.changed_by_name}</span>}
                  </div>
                </div>
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
