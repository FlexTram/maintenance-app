import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAllRecords, getAllEquipment } from '../lib/sync'
import { StatusBadge } from './HomePage'

export default function RecordsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [records,   setRecords]   = useState([])
  const [equipList, setEquipList] = useState([])
  const [equipment, setEquipment] = useState({})
  const [filter,    setFilter]    = useState(searchParams.get('filter') || 'all')
  const [view]                    = useState(searchParams.get('view') || 'equipment')
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [recs, equip] = await Promise.all([getAllRecords(), getAllEquipment()])
      const eqMap = Object.fromEntries(equip.map(e => [e.id, e]))
      setEquipment(eqMap)
      setEquipList(equip)
      setRecords(recs)
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

      {/* Records view */}
      {!loading && view === 'records' && (
        <>
          {filteredRecords.length === 0 && (
            <div className="empty">No {filter !== 'all' ? statusLabel(filter).toLowerCase() : ''} records found.</div>
          )}
          {filteredRecords.map(r => {
            const eq   = equipment[r.equipment_id]
            const date = new Date(r.service_date + 'T12:00:00').toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            })
            return (
              <div
                key={r.localId || r.id}
                className="record"
                style={{ cursor: eq ? 'pointer' : 'default' }}
                onClick={() => eq && navigate(`/equipment/${eq.id}`)}
              >
                <div className="record-header">
                  <span style={{ fontWeight: 500, fontSize: 14 }}>
                    {eq?.name || 'Unknown equipment'}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="record-meta">
                  {r.technician_name} · {date}
                  {r.synced === 0 && <span className="badge badge-offline" style={{ marginLeft: 8 }}>Pending sync</span>}
                </div>
                {r.inspection_notes && (
                  <div className="record-notes">{r.inspection_notes}</div>
                )}
                {r.parts_replaced?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {r.parts_replaced.map((p, i) => <span key={i} className="chip">{p}</span>)}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
