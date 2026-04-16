import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { editRecord } from '../lib/sync'
import { useAuth } from '../lib/auth'
import { FormSectionHeader, FormSubmitBar, PhotoSection, uploadSectionPhotos } from './InspectionForm'

const CONDITION_ITEMS = [
  { key: 'exterior', label: 'Exterior', desc: 'Body, panels, paint' },
  { key: 'canopy',   label: 'Canopy',   desc: 'Frame, fabric, straps' },
  { key: 'seats',    label: 'Seats',    desc: 'Bolts, boards, condition' },
  { key: 'tires',    label: 'Tires',    desc: 'Tread, pressure, damage' },
  { key: 'lights',   label: 'Lights',   desc: 'Running lights, wiring' },
  { key: 'hitch',    label: 'Hitch',    desc: 'Coupler, safety chain' },
]

const initConditions = () =>
  Object.fromEntries(CONDITION_ITEMS.map(c => [c.key, { status: 'good', notes: '' }]))

export default function DropOffEditForm() {
  const { id, recordId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [record, setRecord]           = useState(null)
  const [eq, setEq]                   = useState(null)
  const [conditions, setConditions]   = useState(initConditions())
  const [existingPhotos, setExistingPhotos] = useState({}) // { condKey: ['url1', ...] }
  const [newPhotos, setNewPhotos]     = useState({})       // { condKey: [{ file, preview }] }
  const [removedUrls, setRemovedUrls] = useState(new Set())
  const [saving, setSaving]           = useState(false)
  const [errors, setErrors]           = useState([])

  // Load record + equipment
  useEffect(() => {
    async function load() {
      const r = await db.records.where('localId').equals(Number(recordId)).first()
      if (!r) { setErrors(['Record not found']); return }
      setRecord(r)
      const fd = r.form_data || {}
      setConditions({ ...initConditions(), ...(fd.conditions || {}) })
      setExistingPhotos(fd.photos || {})
      const equipment = await db.equipment.get(id)
      setEq(equipment)
    }
    load()
  }, [id, recordId])

  function setConditionStatus(key, status) {
    setConditions(prev => ({ ...prev, [key]: { ...prev[key], status } }))
  }
  function setConditionNotes(key, notes) {
    setConditions(prev => ({ ...prev, [key]: { ...prev[key], notes } }))
  }

  function handlePhotoChange(sectionKey, photos) {
    setNewPhotos(prev => ({ ...prev, [sectionKey]: photos }))
  }

  function removeExistingPhoto(condKey, url) {
    setRemovedUrls(prev => new Set(prev).add(url))
    setExistingPhotos(prev => ({
      ...prev,
      [condKey]: (prev[condKey] || []).filter(u => u !== url),
    }))
  }

  async function handleSave() {
    setErrors([])
    setSaving(true)
    try {
      // Upload new photos
      const uploadedPhotoUrls = {}
      const newEntries = Object.entries(newPhotos).filter(([, arr]) => arr.length > 0)
      if (newEntries.length > 0) {
        if (navigator.onLine) {
          const timestamp = Date.now()
          for (const [condKey, photos] of newEntries) {
            const urls = await uploadSectionPhotos(condKey, photos, id, timestamp)
            uploadedPhotoUrls[condKey] = urls
          }
        } else {
          window.alert("You're offline — photos were not saved. Your other changes were saved.")
        }
      }

      // Merge photo URLs: kept existing + newly uploaded
      const mergedPhotos = {}
      for (const { key } of CONDITION_ITEMS) {
        const kept = existingPhotos[key] || []
        const added = uploadedPhotoUrls[key] || []
        const all = [...kept, ...added]
        if (all.length > 0) mergedPhotos[key] = all
      }

      const flaggedCount = Object.values(conditions).filter(c => c.status === 'damage').length
      const evName = record.form_data?.event_name || 'Drop-off'

      await editRecord(
        record.localId, record.id,
        {
          inspection_notes: `Drop-off at ${evName}${flaggedCount > 0 ? ` — ${flaggedCount} item${flaggedCount > 1 ? 's' : ''} flagged` : ''}`,
          form_data: {
            ...record.form_data,
            conditions,
            photos: mergedPhotos,
          },
        },
        user?.id, user?.user_metadata?.full_name
      )
      navigate(`/equipment/${id}`)
    } catch (err) {
      console.error('Failed to edit drop-off:', err)
      setErrors(['Failed to save — please try again'])
      setSaving(false)
    }
  }

  if (!record || !eq) return <div className="empty">Loading…</div>

  const fd = record.form_data || {}
  const eventDate = fd.event_date || record.service_date
  const eventDisplay = eventDate
    ? new Date(eventDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div className="page">
      <button className="back" onClick={() => navigate(`/equipment/${id}`)}>← Back</button>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>Edit Drop-Off</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>
        {eq.name}{eq.serial_number ? ` · ${eq.serial_number}` : ''}
      </div>

      {/* Event summary (read-only) */}
      <div className="card" style={{ marginBottom: '1rem', background: '#1a2e1a', borderColor: '#4ade8040' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4ade80', marginBottom: 6 }}>
          Drop-off event
        </div>
        <div style={{ fontSize: 14, color: 'var(--text1)', fontWeight: 600 }}>{fd.event_name || 'Untitled event'}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
          {fd.event_location && <>{fd.event_location} · </>}
          {eventDisplay}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, fontStyle: 'italic' }}>
          Event info applies to all trams in this drop-off — not editable here.
        </div>
      </div>

      <FormSectionHeader title="Condition Check" />
      <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: '1rem' }}>
        {CONDITION_ITEMS.map(({ key, label, desc }) => {
          const cond = conditions[key]
          const isDamage = cond?.status === 'damage'
          const keptUrls = existingPhotos[key] || []
          return (
            <div key={key} style={{ borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{desc}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => setConditionStatus(key, 'good')}
                    style={{
                      width: 'auto', minHeight: 44, padding: '10px 16px', fontSize: 13, fontWeight: 700, borderRadius: 8,
                      border: `1px solid ${!isDamage ? '#4ade80' : 'var(--border)'}`,
                      background: !isDamage ? '#052e16' : 'transparent',
                      color: !isDamage ? '#4ade80' : 'var(--text3)',
                      cursor: 'pointer',
                    }}
                  >Good</button>
                  <button
                    onClick={() => setConditionStatus(key, 'damage')}
                    style={{
                      width: 'auto', minHeight: 44, padding: '10px 16px', fontSize: 13, fontWeight: 700, borderRadius: 8,
                      border: `1px solid ${isDamage ? '#f87171' : 'var(--border)'}`,
                      background: isDamage ? '#450a0a' : 'transparent',
                      color: isDamage ? '#f87171' : 'var(--text3)',
                      cursor: 'pointer',
                    }}
                  >Damage</button>
                </div>
              </div>
              <div style={{ padding: '0 12px 10px 12px' }}>
                {isDamage && (
                  <textarea
                    value={cond.notes}
                    onChange={e => setConditionNotes(key, e.target.value)}
                    placeholder={`Describe ${label.toLowerCase()} damage...`}
                    style={{ minHeight: 56, fontSize: 13, marginBottom: 6 }}
                  />
                )}
                {/* Existing photos */}
                {keptUrls.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                    {keptUrls.map(url => (
                      <div key={url} style={{ position: 'relative', width: 72, height: 72, borderRadius: 6, overflow: 'hidden', border: '0.5px solid var(--border)' }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          onClick={() => removeExistingPhoto(key, url)}
                          aria-label="Remove photo"
                          style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, padding: 0, fontSize: 11, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', color: '#f87171', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                <PhotoSection
                  sectionKey={key}
                  photos={newPhotos[key] || []}
                  onChange={handlePhotoChange}
                  inline
                />
              </div>
            </div>
          )
        })}
      </div>

      {errors.length > 0 && (
        <div style={{ color: '#f87171', fontSize: 13, marginBottom: '1rem' }}>
          {errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      <FormSubmitBar onSubmit={handleSave} saving={saving} submitLabel="Save Changes" />
    </div>
  )
}
