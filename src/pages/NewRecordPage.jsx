import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { saveRecord } from '../lib/sync'
import { useAuth } from '../lib/auth'

export default function NewRecordPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [eq,   setEq]   = useState(null)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Form state
  const [tech,   setTech]   = useState(user?.user_metadata?.full_name || '')
  const [date,   setDate]   = useState(new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState('pass')
  const [notes,  setNotes]  = useState('')
  const [parts,  setParts]  = useState([])
  const [partInput, setPartInput] = useState('')

  useEffect(() => {
    db.equipment.get(id).then(setEq)
  }, [id])

  function addPart() {
    const v = partInput.trim()
    if (!v) return
    setParts(p => [...p, v])
    setPartInput('')
  }

  function removePart(i) {
    setParts(p => p.filter((_, idx) => idx !== i))
  }

  async function submit() {
    setSaving(true)
    await saveRecord({
      equipment_id:     id,
      technician_name:  tech || 'Unknown',
      service_date:     date,
      status,
      inspection_notes: notes,
      parts_replaced:   parts,
      created_by:       user?.id,
    })
    navigate(`/equipment/${id}`)
  }

  if (!eq) return <div className="empty">Loading…</div>

  const steps = ['Details', 'Inspection', 'Review']

  return (
    <div className="page">
      <button className="back" onClick={() => navigate(`/equipment/${id}`)}>← Back</button>
      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2 }}>{eq.name}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1rem' }}>{eq.qr_id}</div>

      {/* Step bar */}
      <div className="steps">
        {steps.map((_, i) => (
          <div key={i} className={`step-seg ${i <= step ? 'active' : ''}`} />
        ))}
      </div>

      {/* Step 0: Who & when */}
      {step === 0 && (
        <div>
          <div className="card">
            <div className="field">
              <label>Technician name</label>
              <input value={tech} onChange={e => setTech(e.target.value)} placeholder="Your name" />
            </div>
            <div className="field">
              <label>Date of service</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="pass">Pass — equipment is operational</option>
                <option value="fail">Fail — equipment needs attention</option>
                <option value="pending">Pending — follow-up required</option>
              </select>
            </div>
          </div>
          <button className="primary" onClick={() => setStep(1)}>Continue →</button>
        </div>
      )}

      {/* Step 1: Inspection notes & parts */}
      {step === 1 && (
        <div>
          <div className="card">
            <div className="field">
              <label>Inspection notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Describe findings, work performed, condition observed…"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Parts replaced</label>
              {parts.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {parts.map((p, i) => (
                    <span key={i} className="chip">
                      {p}
                      <span
                        style={{ cursor: 'pointer', color: 'var(--text3)', fontSize: 11, marginLeft: 2 }}
                        onClick={() => removePart(i)}
                      >✕</span>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={partInput}
                  onChange={e => setPartInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPart())}
                  placeholder="Part name or number"
                  style={{ flex: 1 }}
                />
                <button onClick={addPart} style={{ width: 'auto', padding: '10px 14px' }}>Add</button>
              </div>
            </div>
          </div>
          <div className="stack">
            <button className="primary" onClick={() => setStep(2)}>Review →</button>
            <button onClick={() => setStep(0)}>← Back</button>
          </div>
        </div>
      )}

      {/* Step 2: Review & confirm */}
      {step === 2 && (
        <div>
          <div className="card">
            <div className="section-label" style={{ marginBottom: 12 }}>Review before saving</div>
            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
              {[
                ['Equipment', eq.name],
                ['Technician', tech || '—'],
                ['Date', new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })],
                ['Status', null],
                ['Notes', notes || '—'],
                parts.length ? ['Parts', parts.join(', ')] : null,
              ].filter(Boolean).map(([label, val]) => (
                <tr key={label}>
                  <td style={{ color: 'var(--text2)', paddingBottom: 8, width: 100, verticalAlign: 'top' }}>{label}</td>
                  <td style={{ paddingBottom: 8, fontWeight: 500, verticalAlign: 'top' }}>
                    {label === 'Status'
                      ? <span className={`badge badge-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                      : val}
                  </td>
                </tr>
              ))}
            </table>
          </div>
          <div className="stack">
            <button className="primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : 'Save Record'}
            </button>
            <button onClick={() => setStep(1)}>← Edit</button>
          </div>
        </div>
      )}
    </div>
  )
}
