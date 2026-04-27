import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import {
  saveRecord, sortTrams, getActiveEventsWithDeployments,
  markDeploymentReturned, closeEvent, areAllDeploymentsReturned,
} from '../lib/sync'
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

export default function BatchPickUpForm() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]

  const [step, setStep] = useState(0) // 0=Event, 1=Select, 2=Condition, 3=SignOff
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(true)

  // Step 0 — Event
  const [activeEvents, setActiveEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [tech, setTech] = useState(user?.user_metadata?.full_name || '')
  const [pickUpDate, setPickUpDate] = useState(today)

  // Step 1 — Select trams
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [expandedTramIds, setExpandedTramIds] = useState(new Set())

  // Step 2 — Per-tram pick-up conditions & photos
  const [pickupConditions, setPickupConditions] = useState({})  // { equipmentId: { key: { status, notes } } }
  const [tramPhotos, setTramPhotos] = useState({})              // { `${equipmentId}_${conditionKey}`: [{ file, preview }] }
  const [dropoffByTram, setDropoffByTram] = useState({})        // { equipmentId: { conditions, photos } }

  // Step 3 — Sign off
  const [techSig, setTechSig] = useState(user?.user_metadata?.full_name || '')
  const [customerSig, setCustomerSig] = useState('')
  const [markEventComplete, setMarkEventComplete] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load events + deployments on mount
  useEffect(() => {
    async function load() {
      const events = await getActiveEventsWithDeployments()
      setActiveEvents(events)
      if (events.length === 1) setSelectedEventId(events[0].id)
      setLoading(false)
    }
    load()
  }, [])

  const currentEvent = activeEvents.find(e => e.id === selectedEventId)
  const sortedDeployments = currentEvent
    ? sortTrams(currentEvent.deployments.map(d => d.equipment).filter(Boolean))
        .map(eq => currentEvent.deployments.find(d => d.equipment_id === eq.id))
    : []
  const selectedDeployments = sortedDeployments.filter(d => selectedIds.has(d.equipment_id))

  // Load drop-off records for the selected trams when entering step 2
  useEffect(() => {
    if (step !== 2 || selectedDeployments.length === 0) return
    async function loadDropoffs() {
      const byTram = {}
      for (const dep of selectedDeployments) {
        if (!dep.drop_off_record_id) continue
        const record = await db.records.where('id').equals(dep.drop_off_record_id).first()
        if (record?.form_data) {
          byTram[dep.equipment_id] = {
            conditions: record.form_data.conditions || {},
            photos: record.form_data.photos || {},
          }
        }
      }
      setDropoffByTram(byTram)
    }
    loadDropoffs()
  }, [step, selectedEventId])

  // Initialize pickup conditions when selection changes
  useEffect(() => {
    setPickupConditions(prev => {
      const next = { ...prev }
      for (const id of selectedIds) {
        if (!next[id]) next[id] = initConditions()
      }
      return next
    })
  }, [selectedIds])

  // Step navigation
  function nextStep() {
    const errs = []
    if (step === 0) {
      if (!selectedEventId) errs.push('Select an event')
      if (!tech.trim()) errs.push('Enter tech name')
    } else if (step === 1) {
      if (selectedIds.size === 0) errs.push('Select at least one tram')
    } else if (step === 2) {
      for (const dep of selectedDeployments) {
        const conds = pickupConditions[dep.equipment_id] || {}
        const damaged = Object.entries(conds).filter(([, c]) => c?.status === 'damage')
        for (const [key, c] of damaged) {
          if (!c.notes?.trim()) {
            errs.push(`${dep.equipment?.name || 'Tram'} — ${key} damage needs notes`)
          }
        }
      }
    }
    if (errs.length) { setErrors(errs); return }
    setErrors([])
    setStep(step + 1)
  }
  const prevStep = () => { setErrors([]); setStep(Math.max(0, step - 1)) }

  function toggleTram(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function selectAll() { setSelectedIds(new Set(sortedDeployments.map(d => d.equipment_id))) }
  function selectNone() { setSelectedIds(new Set()) }

  function toggleTramExpanded(id) {
    setExpandedTramIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setPickupStatus(tramId, condKey, status) {
    setPickupConditions(prev => ({
      ...prev,
      [tramId]: { ...prev[tramId], [condKey]: { ...prev[tramId]?.[condKey], status } },
    }))
  }
  function setPickupNotes(tramId, condKey, notes) {
    setPickupConditions(prev => ({
      ...prev,
      [tramId]: { ...prev[tramId], [condKey]: { ...prev[tramId]?.[condKey], notes } },
    }))
  }
  function handlePhotoChange(sectionKey, photos) {
    setTramPhotos(prev => ({ ...prev, [sectionKey]: photos }))
  }

  async function handleSave() {
    setErrors([])
    setSaving(true)
    try {
      let syncFailed = false

      // Upload photos first
      const uploadedPhotoUrls = {}
      const photoEntries = Object.entries(tramPhotos).filter(([, arr]) => arr.length > 0)
      if (photoEntries.length > 0) {
        if (navigator.onLine) {
          const timestamp = Date.now()
          for (const [compositeKey, photos] of photoEntries) {
            const [eqId, ...rest] = compositeKey.split('_')
            const condKey = rest.join('_')
            const urls = await uploadSectionPhotos(condKey, photos, eqId, timestamp)
            uploadedPhotoUrls[compositeKey] = urls
          }
        } else {
          window.alert("You're offline — photos were not saved. The rest of your pick-up was saved successfully.")
        }
      }

      // Save one pick-up record per tram + update deployment
      for (const dep of selectedDeployments) {
        const tram = dep.equipment
        if (!tram) continue
        const conditions = pickupConditions[tram.id] || initConditions()
        const dropoff = dropoffByTram[tram.id] || {}

        // Compute new-damage count (was good at drop-off, now damage)
        const newDamageCount = Object.entries(conditions).filter(([key, c]) => {
          const dropStatus = dropoff.conditions?.[key]?.status || 'good'
          return c.status === 'damage' && dropStatus === 'good'
        }).length

        // Collect pick-up photo URLs for this tram
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
          service_date: pickUpDate,
          status: tram.status || 'in_service',
          inspection_notes: `Pick-up from ${currentEvent.name}${newDamageCount > 0 ? ` — ${newDamageCount} new damage` : ''}`,
          parts_replaced: [],
          created_by: user?.id,
          record_type: 'pickup',
          form_data: {
            event_id:         currentEvent.id,
            event_name:       currentEvent.name,
            event_location:   currentEvent.location,
            event_start_date: currentEvent.start_date,
            pick_up_date:     pickUpDate,
            conditions,
            photos,
            dropoff_comparison: {
              drop_off_record_id: dep.drop_off_record_id,
              dropped_off_at:     dep.dropped_off_at,
              conditions:         dropoff.conditions || {},
            },
            tech_signature:     techSig,
            customer_signature: customerSig || null,
            new_damage_count:   newDamageCount,
          },
        })
        if (!result.didSync) syncFailed = true

        // Update deployment — only if we got a Supabase id back (online)
        if (result.didSync && result.id) {
          await markDeploymentReturned(dep.id, result.id, pickUpDate)
        }
      }

      // Optionally close event if requested OR all deployments in this event now returned
      if (markEventComplete || await areAllDeploymentsReturned(currentEvent.id)) {
        await closeEvent(currentEvent.id)
      }

      if (syncFailed) {
        alert('Records saved to your device but failed to sync. They will appear on the home screen for manual sync.')
      }
      navigate('/')
    } catch (err) {
      console.error('Failed to save pick-up:', err)
      setErrors(['Failed to save — please try again'])
      setSaving(false)
    }
  }

  // ── Render ──
  if (loading) return <div className="empty">Loading…</div>
  if (activeEvents.length === 0) {
    return (
      <div className="page">
        <button className="back" onClick={() => navigate('/')}>← Home</button>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: '1rem' }}>Log Pick-Up</div>
        <div className="empty">
          No active events with deployed trams.<br />
          <span style={{ fontSize: 12 }}>Pick-ups require a drop-off to be logged first.</span>
        </div>
        <button
          onClick={() => navigate('/dropoff')}
          style={{ width: '100%', marginTop: 12, padding: 12, background: 'transparent', color: '#94a3b8', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}
        >
          Log drop-off instead →
        </button>
      </div>
    )
  }

  const statusChip = (label, color, bg) => (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 10, color, background: bg }}>
      {label}
    </span>
  )

  return (
    <div className="page" style={{ paddingBottom: 100 }}>
      <button className="back" onClick={() => step === 0 ? navigate('/') : prevStep()}>
        {step === 0 ? '← Home' : '← Back'}
      </button>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>Log Pick-Up</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1rem' }}>
        Step {step + 1} of 4 — {['Event', 'Select Trams', 'Condition Check', 'Sign Off'][step]}
      </div>

      {errors.length > 0 && (
        <div style={{ color: '#f87171', fontSize: 13, marginBottom: '1rem', padding: 8, background: '#450a0a', borderRadius: 6 }}>
          {errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {/* Step 0 — Event selection */}
      {step === 0 && (
        <>
          <FormSectionHeader title="Which event?" />
          {activeEvents.map(ev => (
            <div
              key={ev.id}
              role="button" tabIndex="0"
              onClick={() => setSelectedEventId(ev.id)}
              onKeyDown={e => e.key === 'Enter' && setSelectedEventId(ev.id)}
              style={{
                padding: 14, marginBottom: 8, borderRadius: 10, cursor: 'pointer',
                background: selectedEventId === ev.id ? '#1a2e1a' : 'var(--bg2)',
                border: `1px solid ${selectedEventId === ev.id ? '#4ade80' : 'var(--border)'}`,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text1)' }}>{ev.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                {ev.location && <>{ev.location} · </>}
                {ev.start_date ? new Date(ev.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
              </div>
              <div style={{ fontSize: 12, color: '#4ade80', marginTop: 4, fontWeight: 600 }}>
                {ev.deployments.length} tram{ev.deployments.length !== 1 ? 's' : ''} still out
              </div>
            </div>
          ))}

          <div style={{ marginTop: 16 }}>
            <FormSectionHeader title="Pick-up details" />
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Tech</label>
            <input value={tech} onChange={e => setTech(e.target.value)} style={{ marginBottom: 10 }} />
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Pick-up date</label>
            <input type="date" value={pickUpDate} onChange={e => setPickUpDate(e.target.value)} style={{ marginBottom: 10 }} />
          </div>

          <button className="primary" onClick={nextStep} style={{ fontSize: 15, fontWeight: 700 }}>
            Next — Select Trams
          </button>
        </>
      )}

      {/* Step 1 — Tram selection */}
      {step === 1 && (
        <>
          <FormSectionHeader title={`Returning from ${currentEvent?.name}`} />
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
            {sortedDeployments.length} tram{sortedDeployments.length !== 1 ? 's' : ''} still out. Select the ones coming back today.
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={selectAll}  style={{ flex: 1, fontSize: 12, padding: '8px 10px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 6, color: 'var(--text2)', cursor: 'pointer' }}>Select all</button>
            <button onClick={selectNone} style={{ flex: 1, fontSize: 12, padding: '8px 10px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 6, color: 'var(--text2)', cursor: 'pointer' }}>Clear</button>
          </div>
          {sortedDeployments.map(dep => {
            const eq = dep.equipment
            const checked = selectedIds.has(dep.equipment_id)
            return (
              <div
                key={dep.id}
                role="button" tabIndex="0"
                onClick={() => toggleTram(dep.equipment_id)}
                onKeyDown={e => e.key === 'Enter' && toggleTram(dep.equipment_id)}
                style={{
                  padding: 10, marginBottom: 6, borderRadius: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: checked ? '#1a2e1a' : 'var(--bg2)',
                  border: `1px solid ${checked ? '#4ade80' : 'var(--border)'}`,
                }}
              >
                <span style={{ fontSize: 18, color: checked ? '#4ade80' : 'var(--text3)' }}>
                  {checked ? '☑' : '☐'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>{eq?.name || 'Unknown'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                    {eq?.serial_number || ''}
                    {dep.department && <span style={{ color: '#fbbf24', fontWeight: 600 }}>{eq?.serial_number ? ' · ' : ''}{dep.department}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  out since {dep.dropped_off_at ? new Date(dep.dropped_off_at + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>
            )
          })}
          <button className="primary" onClick={nextStep} style={{ fontSize: 15, fontWeight: 700, marginTop: 10 }}>
            Next — Condition Check
          </button>

          <div style={{ marginTop: 16, padding: '10px 12px', background: 'var(--bg2)', border: '0.5px dashed var(--border2)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
              <strong style={{ color: 'var(--text1)' }}>Don't see a tram you need to pick up?</strong>
              {' '}It's missing a drop-off record for this event.
            </div>
            <button
              onClick={() => navigate('/dropoff')}
              style={{ width: 'auto', fontSize: 12, padding: '6px 12px', background: 'transparent', color: '#4ade80', border: '0.5px solid #4ade8060', borderRadius: 6, cursor: 'pointer' }}
            >
              Log drop-off first →
            </button>
          </div>
        </>
      )}

      {/* Step 2 — Condition check with side-by-side drop-off */}
      {step === 2 && (
        <>
          <FormSectionHeader title="Condition Check" />
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
            Each tram shows its drop-off condition above your pick-up input. Anything new marked <span style={{ color: '#f87171', fontWeight: 600 }}>Damage</span> will be flagged as new damage vs. drop-off.
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setExpandedTramIds(new Set(selectedDeployments.map(d => d.equipment_id)))} style={{ flex: 1, fontSize: 12, padding: '8px 10px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 6, color: 'var(--text2)', cursor: 'pointer' }}>Expand all</button>
            <button onClick={() => setExpandedTramIds(new Set())}                                           style={{ flex: 1, fontSize: 12, padding: '8px 10px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 6, color: 'var(--text2)', cursor: 'pointer' }}>Collapse all</button>
          </div>

          {selectedDeployments.map((dep, idx) => {
            const tram = dep.equipment
            if (!tram) return null
            const conditions = pickupConditions[tram.id] || initConditions()
            const dropoff = dropoffByTram[tram.id] || {}
            const isExpanded = expandedTramIds.has(tram.id)
            const newDamageCount = Object.entries(conditions).filter(([key, c]) => {
              const dropStatus = dropoff.conditions?.[key]?.status || 'good'
              return c.status === 'damage' && dropStatus === 'good'
            }).length
            const damageCount = Object.values(conditions).filter(c => c?.status === 'damage').length

            return (
              <div key={tram.id} style={{ marginBottom: '0.75rem' }}>
                <button
                  onClick={() => toggleTramExpanded(tram.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px',
                    background: isExpanded ? 'var(--bg2)' : 'var(--bg1)',
                    border: '0.5px solid var(--border)',
                    borderRadius: isExpanded ? '8px 8px 0 0' : 8,
                    borderBottom: isExpanded ? 'none' : '0.5px solid var(--border)',
                    cursor: 'pointer', textAlign: 'left', color: 'var(--text1)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 700, width: 38, flexShrink: 0 }}>
                      {idx + 1}/{selectedDeployments.length}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{tram.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{tram.serial_number || ''}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {newDamageCount > 0 && statusChip(`${newDamageCount} new`, '#f87171', '#450a0a')}
                    {damageCount === 0 && statusChip('All good', '#4ade80', '#052e16')}
                    <span style={{ fontSize: 14, color: 'var(--text2)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>›</span>
                  </div>
                </button>

                {isExpanded && (
                  <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                    {CONDITION_ITEMS.map(({ key, label, desc }) => {
                      const pickup = conditions[key]
                      const isDamage = pickup?.status === 'damage'
                      const photoKey = `${tram.id}_${key}`
                      const dropStatus = dropoff.conditions?.[key]?.status || 'good'
                      const dropNotes = dropoff.conditions?.[key]?.notes || ''
                      const dropPhotos = dropoff.photos?.[key] || []
                      const isNewDamage = isDamage && dropStatus === 'good'

                      return (
                        <div key={key} style={{ borderBottom: '0.5px solid var(--border)', padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
                              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{desc}</div>
                            </div>
                            {isNewDamage && statusChip('New damage', '#f87171', '#450a0a')}
                          </div>

                          {/* Drop-off snapshot */}
                          <div style={{ background: 'var(--bg)', border: '0.5px dashed var(--border2)', borderRadius: 6, padding: '8px 10px', marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                              At drop-off
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: dropNotes || dropPhotos.length ? 6 : 0 }}>
                              {statusChip(
                                dropStatus === 'damage' ? 'Damage' : 'Good',
                                dropStatus === 'damage' ? '#f87171' : '#4ade80',
                                dropStatus === 'damage' ? '#450a0a' : '#052e16'
                              )}
                              {dropNotes && <span style={{ fontSize: 12, color: 'var(--text2)' }}>{dropNotes}</span>}
                            </div>
                            {dropPhotos.length > 0 && (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {dropPhotos.map((url, i) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                    <img src={url} alt="" loading="lazy" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Pick-up entry */}
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                            At pick-up
                          </div>
                          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                            <button
                              onClick={() => setPickupStatus(tram.id, key, 'good')}
                              style={{
                                width: 'auto', minHeight: 40, padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8,
                                border: `1px solid ${!isDamage ? '#4ade80' : 'var(--border)'}`,
                                background: !isDamage ? '#052e16' : 'transparent',
                                color: !isDamage ? '#4ade80' : 'var(--text3)',
                                cursor: 'pointer',
                              }}
                            >Good</button>
                            <button
                              onClick={() => setPickupStatus(tram.id, key, 'damage')}
                              style={{
                                width: 'auto', minHeight: 40, padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8,
                                border: `1px solid ${isDamage ? '#f87171' : 'var(--border)'}`,
                                background: isDamage ? '#450a0a' : 'transparent',
                                color: isDamage ? '#f87171' : 'var(--text3)',
                                cursor: 'pointer',
                              }}
                            >Damage</button>
                          </div>
                          {isDamage && (
                            <textarea
                              value={pickup.notes}
                              onChange={e => setPickupNotes(tram.id, key, e.target.value)}
                              placeholder={`Describe ${label.toLowerCase()} damage at pick-up...`}
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

      {/* Step 3 — Sign off */}
      {step === 3 && (
        <>
          <FormSectionHeader title="Summary" />
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
              <strong>{currentEvent?.name}</strong>{currentEvent?.location ? ` — ${currentEvent.location}` : ''}<br />
              Picked up by {tech} on {new Date(pickUpDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}<br />
              {selectedDeployments.length} tram{selectedDeployments.length !== 1 ? 's' : ''} returning
            </div>
          </div>

          <FormSectionHeader title="Sign off" />
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Tech signature</label>
          <input value={techSig} onChange={e => setTechSig(e.target.value)} style={{ marginBottom: 10 }} />
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Customer / site rep signature (optional)</label>
          <input value={customerSig} onChange={e => setCustomerSig(e.target.value)} placeholder="Leave blank if not available" style={{ marginBottom: 10 }} />

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 8, marginBottom: '1rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={markEventComplete}
              onChange={e => setMarkEventComplete(e.target.checked)}
              style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, accentColor: '#4ade80' }}
            />
            <span style={{ display: 'block', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text1)', lineHeight: 1.3 }}>
                Mark event as complete
              </span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginTop: 2, lineHeight: 1.35 }}>
                Only check if no more trams will be picked up from this event.
              </span>
            </span>
          </label>

          <FormSubmitBar onSubmit={handleSave} saving={saving} submitLabel={`Save Pick-Up (${selectedDeployments.length})`} />
        </>
      )}
    </div>
  )
}
