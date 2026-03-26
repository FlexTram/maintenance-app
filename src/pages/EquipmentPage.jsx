import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { getRecordsForEquipment, getDocumentsForEquipment, getStatusChangesForEquipment, updateEquipmentStatus, voidRecord } from '../lib/sync'
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
  const [timeline, setTimeline] = useState([])
  const [loading,  setLoading] = useState(true)
  const [showStatusPanel, setShowStatusPanel] = useState(false)
  const [selectedStatus,  setSelectedStatus]  = useState(null)
  const [statusNote,      setStatusNote]      = useState('')
  const [savingStatus,    setSavingStatus]    = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const equipment = await db.equipment.get(id)
      const [recs, documents, statusChanges] = await Promise.all([
        getRecordsForEquipment(id),
        getDocumentsForEquipment(id),
        getStatusChangesForEquipment(id),
      ])
      if (cancelled) return
      setEq(equipment)
      setRecords(recs)
      setDocs(documents)

      // Build merged timeline
      const merged = [
        ...recs.map(r => ({ ...r, _type: 'record', _sortDate: r.service_date })),
        ...statusChanges.map(sc => ({ ...sc, _type: 'status_change', _sortDate: sc.changed_at?.split('T')[0] || sc.changed_at })),
      ].sort((a, b) => (b._sortDate || '').localeCompare(a._sortDate || ''))
      setTimeline(merged)

      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [id])

  async function handleStatusSave() {
    if (!selectedStatus || !statusNote.trim()) return
    setSavingStatus(true)
    await updateEquipmentStatus(id, selectedStatus, statusNote.trim(), user?.id, user?.user_metadata?.full_name)
    setEq(prev => ({ ...prev, status: selectedStatus, status_note: statusNote.trim() }))
    setShowStatusPanel(false)
    setSelectedStatus(null)
    setStatusNote('')
    setSavingStatus(false)
  }

  async function handleVoid(entry, reason) {
    await voidRecord(entry.localId, entry.id, reason, user?.id)
    setTimeline(prev => prev.map(t =>
      (t.localId === entry.localId || t.id === entry.id) && t._type === 'record'
        ? { ...t, voided: true, voided_reason: reason }
        : t
    ))
    setRecords(prev => prev.map(r =>
      (r.localId === entry.localId || r.id === entry.id)
        ? { ...r, voided: true, voided_reason: reason }
        : r
    ))
  }

  const activeTimeline = timeline.filter(t => t._type !== 'record' || !t.voided)
  const voidedRecords = timeline.filter(t => t._type === 'record' && t.voided)

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

      {/* Status control — hidden for retired equipment */}
      {eq.status !== 'retired' && <div style={{ marginBottom: '1rem' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={handleStatusSave}
                disabled={!selectedStatus || !statusNote.trim() || savingStatus}
                style={{ width: '100%', fontSize: 15, padding: '13px', fontWeight: 700, border: 'none', borderRadius: 8, background: !selectedStatus || !statusNote.trim() ? '#1e293b' : '#f59e0b', color: !selectedStatus || !statusNote.trim() ? '#475569' : '#0a0f1a', cursor: !selectedStatus || !statusNote.trim() ? 'default' : 'pointer', letterSpacing: '0.02em' }}
              >
                {savingStatus ? 'Saving…' : 'Save Status'}
              </button>
              <button
                onClick={() => { setShowStatusPanel(false); setSelectedStatus(null); setStatusNote('') }}
                style={{ width: '100%', fontSize: 13, padding: '9px', background: 'transparent', color: '#475569', border: 'none' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>}

      {eq.status !== 'retired' && (
        <div className="stack" style={{ marginBottom: '1.5rem' }}>
          <button className="primary" onClick={() => navigate(`/equipment/${id}/new/inspection`)}>
            + Log Inspection
          </button>
          <button onClick={() => navigate(`/equipment/${id}/new/repair`)}>
            + Log Repair
          </button>
        </div>
      )}

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

      {/* History Timeline */}
      {/* Active Records */}
      <div className="section-label">Active Records</div>
      {activeTimeline.length === 0 ? (
        <div className="empty">No records yet for this equipment.</div>
      ) : (
        activeTimeline.map((entry, i) =>
          entry._type === 'status_change'
            ? <StatusChangeCard key={`sc-${entry.id || i}`} change={entry} />
            : <RecordCard key={entry.localId || entry.id} record={entry} onVoid={handleVoid} />
        )
      )}

      {/* Voided Records */}
      {voidedRecords.length > 0 && (
        <details style={{ marginTop: '1.5rem' }}>
          <summary style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: '#64748b', cursor: 'pointer', padding: '8px 0', listStyle: 'none',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 10, transition: 'transform 0.2s' }}>▶</span>
            Voided Records ({voidedRecords.length})
          </summary>
          <div style={{ marginTop: 8 }}>
            {voidedRecords.map(entry => (
              <RecordCard key={entry.localId || entry.id} record={entry} onVoid={handleVoid} />
            ))}
          </div>
        </details>
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

function RecordTypeBadge({ type }) {
  const isInspection = type === 'inspection'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: 4,
      background: isInspection ? '#1e3a5f' : '#5c2d0e',
      color: isInspection ? '#60a5fa' : '#fb923c',
    }}>
      {isInspection ? 'Inspection' : 'Repair'}
    </span>
  )
}

function RecordCard({ record: r, onVoid }) {
  const [showVoidConfirm, setShowVoidConfirm] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  const date = new Date(r.service_date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })
  const roNumber = r.form_data?.ro_number
  const isVoided = r.voided

  async function confirmVoid() {
    if (!voidReason.trim()) return
    setVoiding(true)
    await onVoid(r, voidReason.trim())
    setShowVoidConfirm(false)
    setVoiding(false)
  }

  return (
    <div className="record" style={isVoided ? { opacity: 0.5, background: '#1e293b' } : {}}>
      <div className="record-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {r.record_type && <RecordTypeBadge type={r.record_type} />}
          <span style={{ fontWeight: 500, fontSize: 14, textDecoration: isVoided ? 'line-through' : 'none' }}>{r.technician_name}</span>
          {isVoided && (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4, background: '#450a0a', color: '#f87171' }}>
              Voided
            </span>
          )}
        </div>
        {!isVoided && !showVoidConfirm && (
          <button onClick={() => setShowVoidConfirm(true)}
            style={{ fontSize: 11, color: '#64748b', background: 'transparent', border: '1px solid #1e293b', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', width: 'auto' }}>
            Void
          </button>
        )}
      </div>
      <div className="record-meta" style={{ textDecoration: isVoided ? 'line-through' : 'none' }}>
        {date}
        {roNumber && <span style={{ marginLeft: 8, color: 'var(--accent)', fontWeight: 600 }}>{roNumber}</span>}
        {r.synced === 0 && <span className="badge badge-offline" style={{ marginLeft: 8 }}>Pending sync</span>}
      </div>
      {isVoided && r.voided_reason && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#f87171', fontStyle: 'italic' }}>
          Void reason: {r.voided_reason}
        </div>
      )}
      {!isVoided && r.inspection_notes && (
        <div className="record-notes">{r.inspection_notes}</div>
      )}
      {!isVoided && r.parts_replaced?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {r.parts_replaced.map((p, i) => (
            <span key={i} className="chip">{p}</span>
          ))}
        </div>
      )}
      {showVoidConfirm && !isVoided && (
        <div style={{ marginTop: 10, padding: 10, background: '#1e293b', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#f87171', marginBottom: 6 }}>Void this record?</div>
          <textarea
            value={voidReason} onChange={e => setVoidReason(e.target.value)}
            placeholder="Reason for voiding (required)…"
            style={{ fontSize: 13, minHeight: 60, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={confirmVoid} disabled={!voidReason.trim() || voiding}
              style={{ flex: 1, fontSize: 13, fontWeight: 700, padding: '8px 0', borderRadius: 6, border: 'none', background: !voidReason.trim() ? '#1e293b' : '#ef4444', color: !voidReason.trim() ? '#475569' : '#fff', cursor: !voidReason.trim() ? 'default' : 'pointer' }}>
              {voiding ? 'Voiding…' : 'Confirm Void'}
            </button>
            <button onClick={() => { setShowVoidConfirm(false); setVoidReason('') }}
              style={{ flex: 1, fontSize: 13, padding: '8px 0', borderRadius: 6, background: 'transparent', color: '#64748b', border: '1px solid #1e293b' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusChangeCard({ change: sc }) {
  const date = sc.changed_at
    ? new Date(sc.changed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Unknown date'

  const statusLabel = s => (s || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const statusColor = s => s === 'in_service' ? '#4ade80' : s === 'out_of_service' ? '#f87171' : '#fb923c'

  // Badge color reflects the outcome (new_status)
  const badgeColor = statusColor(sc.new_status)
  const badgeBg = sc.new_status === 'in_service' ? '#052e16'
    : sc.new_status === 'out_of_service' ? '#450a0a' : '#431407'
  const borderColor = statusColor(sc.new_status)

  return (
    <div style={{
      borderLeft: `3px solid ${borderColor}`, padding: '10px 14px', marginBottom: 8,
      background: 'var(--surface)', borderRadius: '0 8px 8px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4, background: badgeBg, color: badgeColor }}>
            Status Change
          </span>
          <span style={{ color: statusColor(sc.old_status) }}>{statusLabel(sc.old_status)}</span>
          <span style={{ color: '#64748b' }}>→</span>
          <span style={{ color: statusColor(sc.new_status) }}>{statusLabel(sc.new_status)}</span>
        </div>
      </div>
      {sc.note && (
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6, lineHeight: 1.5 }}>{sc.note}</div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
        {date}
        {sc.changed_by_name && <span style={{ marginLeft: 8 }}>· {sc.changed_by_name}</span>}
      </div>
    </div>
  )
}


