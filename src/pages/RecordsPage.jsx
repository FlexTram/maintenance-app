import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllRecords, getAllEquipment } from '../lib/sync'

export default function RecordsPage() {
  const navigate = useNavigate()
  const [records,   setRecords]   = useState([])
  const [equipment, setEquipment] = useState({})
  const [filter,    setFilter]    = useState('all')
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [recs, equip] = await Promise.all([getAllRecords(), getAllEquipment()])
      const eqMap = Object.fromEntries(equip.map(e => [e.id, e]))
      setEquipment(eqMap)
      setRecords(recs)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = filter === 'all' ? records : records.filter(r => r.status === filter)

  return (
    <div className="page">
      <button className="back" onClick={() => navigate('/')}>← Home</button>
      <div style={{ fontWeight: 600, fontSize: 18, marginBottom: '1rem' }}>All records</div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['all', 'pass', 'fail', 'pending'].map(f => (
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
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading && <div className="empty">Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div className="empty">No {filter !== 'all' ? filter : ''} records found.</div>
      )}

      {filtered.map(r => {
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
              <span className={`badge badge-${r.status}`}>
                {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
              </span>
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
    </div>
  )
}
