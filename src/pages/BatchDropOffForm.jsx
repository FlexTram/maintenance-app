import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { saveRecord, sortTrams } from '../lib/sync'
import { useAuth } from '../lib/auth'
import { FormSectionHeader, FormField, FormSubmitBar, PhotoSection, uploadSectionPhotos } from './InspectionForm'

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

export default function BatchDropOffForm() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]

  // Step state
  const [step, setStep] = useState(0) // 0=Event, 1=Select, 2=Condition, 3=SignOff
  const [errors, setErrors] = useState([])

  // Step 0 — Event info
  const [eventName, setEventName]       = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventDate, setEventDate]       = useState(today)
  const [tech, setTech]                 = useState(user?.user_metadata?.full_name || '')

  // Step 1 — Select trams
  const [fleet, setFleet]               = useState([])
  const [selectedIds, setSelectedIds]   = useState(new Set())

  // Step 2 — Per-tram conditions & photos
  const [tramConditions, setTramConditions] = useState({}) // { equipmentId: { exterior: { status, notes }, ... } }
  const [tramPhotos, setTramPhotos]         = useState({}) // { `${equipmentId}_${conditionKey}`: [{ file, preview }] }
  const [expandedTramIds, setExpandedTramIds] = useState(new Set())

  function toggleTramExpanded(id) {
    setExpandedTramIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Step 3 — Signatures
  const [techSig, setTechSig]         = useState(user?.user_metadata?.full_name || '')
  const [customerSig, setCustomerSig] = useState('')
  const [saving, setSaving]           = useState(false)

  // Load fleet on mount
  useEffect(() => {
    db.equipment.toArray().then(equip => {
      const active = sortTrams(equip.filter(e => e.status !== 'retired'))
      setFleet(active)
    })
  }, [])

  // Initialize conditions when selection changes
  useEffect(() => {
    setTramConditions(prev => {
      const next = { ...prev }
      for (const id of selectedIds) {
        if (!next[id]) next[id] = initConditions()
      }
      return next
    })
  }, [selectedIds])

  const selectedTrams = fleet.filter(e => selectedIds.has(e.id))

  // ── Step navigation ──

  function nextStep() {
    const errs = []
    if (step === 0) {
      if (!eventName.trim()) errs.push('Event Name is required')
      if (!eventLocation.trim()) errs.push('Location is required')
      if (!eventDate) errs.push('Date is required')
      if (!tech.trim()) errs.push('Technician Name is required')
    } else if (step === 1) {
      if (selectedIds.size === 0) errs.push('Select at least one tram')
    } else if (step === 2) {
      // No required fields — conditions default to "good"
    }
    if (errs.length) {
      setErrors(errs)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setErrors([])
    setStep(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function prevStep() {
    setErrors([])
    setStep(s => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Condition helpers ──

  function setConditionStatus(tramId, condKey, status) {
    setTramConditions(prev => ({
      ...prev,
      [tramId]: { ...prev[tramId], [condKey]: { ...prev[tramId][condKey], status } }
    }))
  }

  function setConditionNotes(tramId, condKey, notes) {
    setTramConditions(prev => ({
      ...prev,
      [tramId]: { ...prev[tramId], [condKey]: { ...prev[tramId][condKey], notes } }
    }))
  }

  function handlePhotoChange(sectionKey, photos) {
    setTramPhotos(prev => ({ ...prev, [sectionKey]: photos }))
  }

  // ── Submit ──

  async function submit() {
    const errs = []
    if (!techSig.trim()) errs.push('Technician Signature is required')
    if (errs.length) {
      setErrors(errs)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setErrors([])
    setSaving(true)
    try {
      let syncFailed = false
      // Upload photos if online
      const uploadedPhotoUrls = {} // { `${equipmentId}_${condKey}`: ['url1', ...] }
      const photoEntries = Object.entries(tramPhotos).filter(([, arr]) => arr.length > 0)
      if (photoEntries.length > 0) {
        if (navigator.onLine) {
          const timestamp = Date.now()
          for (const [compositeKey, photos] of photoEntries) {
            // compositeKey is `${equipmentId}_${conditionKey}`
            const [eqId, ...rest] = compositeKey.split('_')
            const condKey = rest.join('_')
            const urls = await uploadSectionPhotos(condKey, photos, eqId, timestamp)
            uploadedPhotoUrls[compositeKey] = urls
          }
        } else {
          window.alert("You're offline — photos were not saved. The rest of your drop-off was saved successfully.")
        }
      }

      // Save one record per tram
      const batchSize = selectedTrams.length
      for (const tram of selectedTrams) {
        const conditions = tramConditions[tram.id] || initConditions()
        const flaggedCount = Object.values(conditions).filter(c => c.status === 'damage').length

        // Collect photo URLs for this tram
        const photos = {}
        for (const { key } of CONDITION_ITEMS) {
          const compositeKey = `${tram.id}_${key}`
          if (uploadedPhotoUrls[compositeKey]?.length) {
            photos[key] = uploadedPhotoUrls[compositeKey]
          }
        }

        const result = await saveRecord({
          equipment_id: tram.id,
          technician_name: tech,
          service_date: eventDate,
          status: tram.status || 'in_service',
          inspection_notes: `Drop-off at ${eventName}${flaggedCount > 0 ? ` — ${flaggedCount} item${flaggedCount > 1 ? 's' : ''} flagged` : ''}`,
          parts_replaced: [],
          created_by: user?.id,
          record_type: 'dropoff',
          form_data: {
            event_name: eventName,
            event_location: eventLocation,
            event_date: eventDate,
            batch_size: batchSize,
            conditions,
            photos,
            tech_signature: techSig,
            customer_signature: customerSig || null,
          },
        })
        if (!result.didSync) syncFailed = true
      }

      if (syncFailed) {
        alert('Records saved to your device but failed to sync to the cloud. They will appear on the home screen for manual sync.')
      }
      navigate('/')
    } catch (err) {
      console.error('Failed to save drop-off:', err)
      setErrors(['Failed to save — please try again'])
      setSaving(false)
    }
  }

  // ── Render ──

  return (
    <div className="page">
      <button className="back" onClick={() => step === 0 ? navigate('/') : prevStep()}>
        ← {step === 0 ? 'Home' : 'Back'}
      </button>

      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>Batch Drop-Off</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1.5rem' }}>
        Step {step + 1} of 4 — {['Event Info', 'Select Trams', 'Condition Check', 'Sign Off'][step]}
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? '#f59e0b' : 'var(--border)' }} />
        ))}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div role="alert" style={{ background: '#ef44441a', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>Please fix the following:</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#ef4444', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Step 0 — Event Info */}
      {step === 0 && (
        <>
          <FormSectionHeader title="Event Information" />
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <FormField label="Event Name *">
                  <input value={eventName} onChange={e => { setEventName(e.target.value); setErrors([]) }} placeholder="e.g. Phoenix Light Rail Festival"
                    autoComplete="off" style={errors.length && !eventName.trim() ? { borderColor: '#ef4444' } : {}} />
                </FormField>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <FormField label="Location *">
                  <input value={eventLocation} onChange={e => { setEventLocation(e.target.value); setErrors([]) }} placeholder="e.g. 3rd St & Washington"
                    autoComplete="street-address" style={errors.length && !eventLocation.trim() ? { borderColor: '#ef4444' } : {}} />
                </FormField>
              </div>
              <FormField label="Date *">
                <input type="date" value={eventDate} onChange={e => { setEventDate(e.target.value); setErrors([]) }} />
              </FormField>
              <FormField label="Technician / Driver *">
                <input value={tech} onChange={e => { setTech(e.target.value); setErrors([]) }} placeholder="Your name"
                  autoComplete="name" style={errors.length && !tech.trim() ? { borderColor: '#ef4444' } : {}} />
              </FormField>
            </div>
          </div>
          <button className="primary" onClick={nextStep} style={{ fontSize: 15, fontWeight: 700 }}>
            Next — Select Trams
          </button>
        </>
      )}

      {/* Step 1 — Select Trams */}
      {step === 1 && (
        <>
          <FormSectionHeader title="Select Trams for Drop-Off" />

          {/* Select All toggle */}
          <div
            onClick={() => {
              if (selectedIds.size === fleet.length) {
                setSelectedIds(new Set())
              } else {
                setSelectedIds(new Set(fleet.map(e => e.id)))
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 48, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 8, marginBottom: 8, cursor: 'pointer' }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 6, border: '2px solid var(--border2)',
              background: selectedIds.size === fleet.length ? '#f59e0b' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {selectedIds.size === fleet.length && <span style={{ color: '#0f1117', fontSize: 16, fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Select All ({fleet.length} trams)</span>
          </div>

          {/* Fleet list */}
          <div style={{ maxHeight: 400, overflowY: 'auto', border: '0.5px solid var(--border)', borderRadius: 8 }}>
            {fleet.map(eq => {
              const selected = selectedIds.has(eq.id)
              return (
                <div
                  key={eq.id}
                  onClick={() => {
                    setSelectedIds(prev => {
                      const next = new Set(prev)
                      if (next.has(eq.id)) next.delete(eq.id)
                      else next.add(eq.id)
                      return next
                    })
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 48,
                    borderBottom: '0.5px solid var(--border)', cursor: 'pointer',
                    background: selected ? '#f59e0b10' : 'transparent',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, border: `2px solid ${selected ? '#f59e0b' : 'var(--border2)'}`,
                    background: selected ? '#f59e0b' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {selected && <span style={{ color: '#0f1117', fontSize: 16, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{eq.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{eq.serial_number || eq.qr_id}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>
            {selectedIds.size} tram{selectedIds.size !== 1 ? 's' : ''} selected
          </div>

          <button className="primary" onClick={nextStep} style={{ marginTop: 16, fontSize: 15, fontWeight: 700 }}>
            Next — Condition Check
          </button>
        </>
      )}

      {/* Step 2 — Per-Tram Condition */}
      {step === 2 && (
        <>
          <FormSectionHeader title="Condition Check" />
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
            Quick walk-around for each tram. Photos available on all items for before/after documentation.
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setExpandedTramIds(new Set(selectedTrams.map(t => t.id)))}
              style={{ flex: 1, fontSize: 12, padding: '8px 10px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 6, color: 'var(--text2)', cursor: 'pointer' }}
            >Expand all</button>
            <button
              onClick={() => setExpandedTramIds(new Set())}
              style={{ flex: 1, fontSize: 12, padding: '8px 10px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 6, color: 'var(--text2)', cursor: 'pointer' }}
            >Collapse all</button>
          </div>

          {selectedTrams.map((tram, idx) => {
            const conditions = tramConditions[tram.id] || initConditions()
            const isExpanded = expandedTramIds.has(tram.id)
            const damageCount = Object.values(conditions).filter(c => c?.status === 'damage').length
            const photoCount = CONDITION_ITEMS.reduce((n, { key }) => n + (tramPhotos[`${tram.id}_${key}`]?.length || 0), 0)
            return (
              <div key={tram.id} style={{ marginBottom: '0.75rem' }}>
                {/* Tram header — clickable toggle */}
                <button
                  onClick={() => toggleTramExpanded(tram.id)}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px',
                    background: isExpanded ? 'var(--bg2)' : 'var(--bg1)',
                    border: '0.5px solid var(--border)',
                    borderRadius: isExpanded ? '8px 8px 0 0' : 8,
                    borderBottom: isExpanded ? 'none' : '0.5px solid var(--border)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'var(--text1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 700, width: 38, flexShrink: 0 }}>
                      {idx + 1}/{selectedTrams.length}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{tram.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{tram.serial_number || ''}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {damageCount > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', background: '#450a0a', padding: '3px 8px', borderRadius: 10 }}>
                        {damageCount} damage
                      </span>
                    )}
                    {damageCount === 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', background: '#052e16', padding: '3px 8px', borderRadius: 10 }}>
                        All good
                      </span>
                    )}
                    {photoCount > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text2)' }}>{photoCount} 📷</span>
                    )}
                    <span style={{ fontSize: 14, color: 'var(--text2)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>›</span>
                  </div>
                </button>

                {/* Condition card (collapsible) */}
                {isExpanded && (
                <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                  {CONDITION_ITEMS.map(({ key, label, desc }) => {
                    const cond = conditions[key]
                    const isDamage = cond?.status === 'damage'
                    const photoKey = `${tram.id}_${key}`
                    return (
                      <div key={key} style={{ borderBottom: '0.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{desc}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => setConditionStatus(tram.id, key, 'good')}
                              style={{
                                width: 'auto', minHeight: 44, padding: '10px 16px', fontSize: 13, fontWeight: 700, borderRadius: 8,
                                border: `1px solid ${!isDamage ? '#4ade80' : 'var(--border)'}`,
                                background: !isDamage ? '#052e16' : 'transparent',
                                color: !isDamage ? '#4ade80' : 'var(--text3)',
                                cursor: 'pointer',
                              }}
                            >Good</button>
                            <button
                              onClick={() => setConditionStatus(tram.id, key, 'damage')}
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
                        {/* Notes expand on damage; photos always available */}
                        <div style={{ padding: '0 12px 10px 12px' }}>
                          {isDamage && (
                            <textarea
                              value={cond.notes}
                              onChange={e => setConditionNotes(tram.id, key, e.target.value)}
                              placeholder={`Describe ${label.toLowerCase()} damage...`}
                              style={{ minHeight: 56, fontSize: 13, marginBottom: 6 }}
                            />
                          )}
                          <PhotoSection
                            sectionKey={photoKey}
                            photos={tramPhotos[photoKey] || []}
                            onChange={handlePhotoChange}
                            inline
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                )}
              </div>
            )
          })}

          <button className="primary" onClick={nextStep} style={{ fontSize: 15, fontWeight: 700 }}>
            Next — Sign Off
          </button>
        </>
      )}

      {/* Step 3 — Sign Off */}
      {step === 3 && (
        <>
          <FormSectionHeader title="Summary" />
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
              <strong>{eventName}</strong> — {eventLocation}<br />
              {new Date(eventDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}<br />
              {selectedTrams.length} tram{selectedTrams.length !== 1 ? 's' : ''} · Delivered by {tech}
            </div>

            {/* Flagged items summary */}
            {(() => {
              const flagged = []
              for (const tram of selectedTrams) {
                const conds = tramConditions[tram.id] || {}
                const damages = Object.entries(conds).filter(([, c]) => c.status === 'damage')
                if (damages.length > 0) {
                  flagged.push({ tram, damages })
                }
              }
              if (flagged.length === 0) {
                return <div style={{ marginTop: 10, fontSize: 13, color: '#4ade80', fontWeight: 600 }}>All trams in good condition</div>
              }
              return (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#f87171', marginBottom: 6 }}>Damage Noted</div>
                  {flagged.map(({ tram, damages }) => (
                    <div key={tram.id} style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
                      <strong>{tram.name}</strong>: {damages.map(([key]) => CONDITION_ITEMS.find(c => c.key === key)?.label).join(', ')}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          <FormSectionHeader title="Signatures" />
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              <FormField label="Technician Signature *">
                <input value={techSig} onChange={e => { setTechSig(e.target.value); setErrors([]) }} placeholder="Type full name as signature"
                  autoComplete="name" autoCorrect="off" style={errors.length && !techSig.trim() ? { borderColor: '#ef4444' } : {}} />
              </FormField>
              <FormField label="Customer / Site Rep (Optional)">
                <input value={customerSig} onChange={e => setCustomerSig(e.target.value)} placeholder="Type full name as signature"
                  autoComplete="off" autoCorrect="off" />
              </FormField>
            </div>
          </div>

          <div style={{ height: 80 }} />
          <FormSubmitBar onCancel={() => navigate('/')} onSubmit={submit} saving={saving}
            submitLabel={`Submit Drop-Off (${selectedTrams.length} trams)`} />
        </>
      )}
    </div>
  )
}
