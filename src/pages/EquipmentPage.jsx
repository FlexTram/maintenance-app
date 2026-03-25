import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { getRecordsForEquipment, getDocumentsForEquipment, updateEquipmentStatus } from '../lib/sync'
import { useAuth } from '../lib/auth'
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
  const { user }   = useAuth()
  const [eq,       setEq]      = useState(null)
  const [records,  setRecords] = useState([])
  const [docs,     setDocs]    = useState([])
  const [loading,  setLoading] = useState(true)
  const [showStatusPanel, setShowStatusPanel] = useState(false)
  const [selectedStatus,  setSelectedStatus]  = useState(null)
  const [statusNote,      setStatusNote]      = useState('')
  const [savingStatus,    setSavingStatus]    = useState(false)

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

  async function handleStatusSave() {
    if (!selectedStatus || !statusNote.trim()) return
    setSavingStatus(true)
    await updateEquipmentStatus(id, selectedStatus, statusNote.trim(), user?.id)
    setEq(prev => ({ ...prev, status: selectedStatus, status_note: statusNote.trim() }))
    setShowStatusPanel(false)
    setSelectedStatus(null)
    setStatusNote('')
    setSavingStatus(false)
  }

  if (loading) return <div className="empty">Loading…</div>
  if (!eq)     return <div className="empty">Equipment not found.</div>

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
          <StatusBadge status={eq.status || 'in_service'} />
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

      {/* Status control */}
      <div style={{ marginBottom: '1rem' }}>
        {!showStatusPanel ? (
          <button
            onClick={() => { setShowStatusPanel(true); setSelectedStatus(eq.status || 'in_service') }}
            style={{
              width: '100%',
              borderRadius: 10,
              padding: '11px 14px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              letterSpacing: '0.02em',
              border: 'none',
              ...(eq.status === 'out_of_service'
                ? { background: '#450a0a', color: '#f87171' }
                : eq.status === 'pending'
                ? { background: '#431407', color: '#fb923c' }
                : { background: '#052e16', color: '#4ade80' })
            }}
          >
            <span>Change Status</span>
            <span style={{ fontSize: 12 }}>▾</span>
          </button>
        ) : (
          <div style={{ background: '#0f172a', border: '0.5px solid #1e293b', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Select new status</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
              {[
                { value: 'in_service',     label: 'In Service',     color: '#4ade80', bg: '#052e16' },
                { value: 'out_of_service', label: 'Out of Service', color: '#f87171', bg: '#450a0a' },
                { value: 'pending',        label: 'Pending Review', color: '#fb923c', bg: '#431407' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedStatus(opt.value)}
                  style={{ background: selectedStatus === opt.value ? opt.bg : 'transparent', color: selectedStatus === opt.value ? opt.color : '#64748b', border: `1px solid ${selectedStatus === opt.value ? opt.color : '#1e293b'}`, borderRadius: 8, padding: '8px 4px', fontSize: 11, fontWeight: 600, cursor: 'pointer', width: '100%', lineHeight: 1.3 }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Required: reason for status change…"
              value={statusNote}
              onChange={e => setStatusNote(e.target.value)}
              rows={2}
              style={{ marginBottom: 10, fontSize: 13 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowStatusPanel(false); setSelectedStatus(null); setStatusNote('') }}
                style={{ flex: 1, fontSize: 13, padding: '9px', background: 'transparent', color: '#64748b', border: '0.5px solid #1e293b' }}
              >
                Cancel
              </button>
              <button
                onClick={handleStatusSave}
                disabled={!selectedStatus || !statusNote.trim() || savingStatus}
                style={{ flex: 2, fontSize: 14, padding: '11px', fontWeight: 700, border: 'none', borderRadius: 8, background: !selectedStatus || !statusNote.trim() ? '#1e293b' : '#f59e0b', color: !selectedStatus || !statusNote.trim() ? '#475569' : '#0a0f1a', cursor: !selectedStatus || !statusNote.trim() ? 'default' : 'pointer', letterSpacing: '0.02em' }}
              >
                {savingStatus ? 'Saving…' : 'Save Status'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="stack" style={{ marginBottom: '1.5rem' }}>
        <button className="primary" onClick={() => navigate(`/equipment/${id}/new/inspection`)}>
          + Log Inspection
        </button>
        <button onClick={() => navigate(`/equipment/${id}/new/repair`)}>
          + Log Repair
        </button>
      </div>

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


