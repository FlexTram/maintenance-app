import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { getRecordsForEquipment } from '../lib/sync'

export default function EquipmentPage() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const [eq,       setEq]      = useState(null)
  const [records,  setRecords] = useState([])
  const [loading,  setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const equipment = await db.equipment.get(id)
      const recs      = await getRecordsForEquipment(id)
      setEq(equipment)
      setRecords(recs)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="empty">Loading…</div>
  if (!eq)     return <div className="empty">Equipment not found.</div>

  return (
    <div className="page">
      <button className="back" onClick={() => navigate('/')}>← Home</button>

      {/* Equipment header */}
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 4 }}>{eq.name}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
          {eq.type && <span>{eq.type} · </span>}
          {eq.location}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="chip">{eq.qr_id}</span>
          <span className="chip">{records.length} record{records.length !== 1 ? 's' : ''}</span>
        </div>
        {eq.notes && (
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 10, lineHeight: 1.5 }}>
            {eq.notes}
          </div>
        )}
      </div>

      <button
        className="primary"
        style={{ marginBottom: '1.5rem' }}
        onClick={() => navigate(`/equipment/${id}/new`)}
      >
        + New Maintenance Record
      </button>

      {/* History */}
      <div className="section-label">Maintenance history</div>
      {records.length === 0 ? (
        <div className="empty">No records yet for this equipment.</div>
      ) : (
        records.map(r => <RecordCard key={r.localId || r.id} record={r} />)
      )}
    </div>
  )
}

function RecordCard({ record: r }) {
  const date = new Date(r.service_date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })

  return (
    <div className="record">
      <div className="record-header">
        <span style={{ fontWeight: 500, fontSize: 14 }}>{r.technician_name}</span>
        <StatusBadge status={r.status} />
      </div>
      <div className="record-meta">
        {date}
        {r.synced === 0 && <span className="badge badge-offline" style={{ marginLeft: 8 }}>Pending sync</span>}
      </div>
      {r.inspection_notes && (
        <div className="record-notes">{r.inspection_notes}</div>
      )}
      {r.parts_replaced?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {r.parts_replaced.map((p, i) => (
            <span key={i} className="chip">{p}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = { pass: 'Pass', fail: 'Fail', pending: 'Pending' }
  return <span className={`badge badge-${status}`}>{map[status] || status}</span>
}
