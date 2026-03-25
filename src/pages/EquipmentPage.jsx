import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { getRecordsForEquipment, getDocumentsForEquipment } from '../lib/sync'
import { StatusBadge } from './HomePage'

const SUBCATEGORY_LABELS = {
  model_sb_standard: 'Model SB Standard',
  receiving:         'Receiving',
  on_site:           'On-Site',
  shipping:          'Shipping',
  tram_rodeo:        'Tram Rodeo',
}

export default function EquipmentPage() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const [eq,       setEq]      = useState(null)
  const [records,  setRecords] = useState([])
  const [docs,     setDocs]    = useState([])
  const [loading,  setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const equipment = await db.equipment.get(id)
      const [recs, documents] = await Promise.all([
        getRecordsForEquipment(id),
        getDocumentsForEquipment(id),
      ])
      setEq(equipment)
      setRecords(recs)
      setDocs(documents)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="empty">Loading…</div>
  if (!eq)     return <div className="empty">Equipment not found.</div>

  const lastRecord  = records[0] ?? null

  return (
    <div className="page">
      <button className="back" onClick={() => navigate('/')}>← Home</button>

      {/* Vehicle profile card */}
      <div className="card" style={{ marginBottom: '1rem' }}>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.3px' }}>
              {eq.name}{eq.model ? ` — ${eq.model}` : ''}
            </div>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>
              {eq.serial_number || eq.qr_id}
            </div>
          </div>
          {lastRecord && <StatusBadge status={lastRecord.status} />}
        </div>

        {/* Profile fields grid */}
        {(eq.serial_number || eq.model_year || eq.manufacturer || eq.model || eq.canopy_details) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', borderTop: '0.5px solid var(--border)', paddingTop: 12 }}>
            {eq.serial_number  && <ProfileField label="Serial Number" value={eq.serial_number} />}
            {eq.model_year     && <ProfileField label="Model Year"    value={eq.model_year} />}
            {eq.manufacturer   && <ProfileField label="Manufacturer"  value={eq.manufacturer} />}
            {eq.model          && <ProfileField label="Model"         value={eq.model} />}
            {eq.canopy_details && <ProfileField label="Canopy"        value={eq.canopy_details} />}
            <ProfileField label="Records" value={`${records.length} total`} />
          </div>
        )}

        {/* Notes (e.g. Tram 14/15 DNE notice) */}
        {eq.notes && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#431407', borderRadius: 8, fontSize: 13, color: '#fb923c', lineHeight: 1.5 }}>
            ⚠️ {eq.notes}
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

      {/* Documents */}
      {['technical_drawing', 'service_procedure'].map(category => {
        const categoryDocs = docs.filter(d => d.category === category)
        if (categoryDocs.length === 0) return null
        const label = category === 'technical_drawing' ? 'Technical Drawings' : 'Service Procedures'
        const bySubcategory = categoryDocs.reduce((acc, d) => {
          const key = d.subcategory || 'other'
          if (!acc[key]) acc[key] = []
          acc[key].push(d)
          return acc
        }, {})
        return (
          <div key={category} style={{ marginBottom: '1.5rem' }}>
            <div className="section-label">{label}</div>
            {Object.entries(bySubcategory).map(([sub, subDocs]) => (
              <div key={sub} className="card" style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  {SUBCATEGORY_LABELS[sub] || sub}
                </div>
                {subDocs.map(doc => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid var(--border)', textDecoration: 'none', color: 'var(--text1)' }}
                  >
                    <span style={{ fontSize: 14 }}>{doc.title}</span>
                    <span style={{ fontSize: 13, color: 'var(--accent)' }}>Open →</span>
                  </a>
                ))}
              </div>
            ))}
          </div>
        )
      })}

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

function ProfileField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text1)', fontWeight: 500 }}>
        {value}
      </div>
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


