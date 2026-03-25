import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { saveRecord } from '../lib/sync'
import { useAuth } from '../lib/auth'

const WHEEL_ITEMS    = ['Wheel Hub', 'Wheel Bearing Outer', 'Wheel Bearing Inner', 'Tire Tread']
const STEERING_ITEMS = ['Axle Rod', 'Steering Bushings Top', 'Steering Bushings Bottom', 'Tie Rod']
const HITCH_ITEMS    = ['Column Bushings Top', 'Column Bushings Bottom', 'Trailer Coupler, Lever, Safety Clip, Safety Chain', 'Ball Receptacle', 'Latch Bolt and Spring']
const WIRING_ITEMS   = ['Junction Box Front', 'Junction Box Rear', 'Wiring Harness Front', 'Wiring Harness Rear', 'SO Wiring Chord', 'Running Lights Front', 'Running Lights Rear', 'Cabin Overhead Lights', 'Bolts/Screws/Clamps Holding Wiring']
const UNDER_ITEMS    = ['Wheel Wells', 'Forklift Holds', 'Welds', 'Steering Rod']
const ABOVE_ITEMS    = ['Seat Bolts / Fasteners', 'Column Bolts / Fasteners', 'Seat Boards', 'Diamond Plate', 'Corrugated Metal Front and Back', 'Powder Coating', 'Safety DOT Reflective Tape']

const initItems  = items => Object.fromEntries(items.map(i => [i, '']))
const initCorner = items => ({ items: initItems(items), tire_pressure: '', alignment: '', comments: '' })
const initSteer  = items => ({ items: initItems(items), comments: '' })

export default function InspectionForm() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [eq, setEq]       = useState(null)
  const [saving, setSaving] = useState(false)

  const [tech, setTech]   = useState(user?.user_metadata?.full_name || '')
  const [date, setDate]   = useState(new Date().toISOString().split('T')[0])
  const [ro, setRo]       = useState('')
  const [ada, setAda]     = useState('')
  const [status, setStatus] = useState('in_service')
  const [generalComments, setGeneralComments] = useState('')
  const [techSig, setTechSig]     = useState('')
  const [techSigDate, setTechSigDate] = useState(new Date().toISOString().split('T')[0])
  const [supSig, setSupSig]       = useState('')
  const [supSigDate, setSupSigDate] = useState('')

  const [wheelLF, setWheelLF] = useState(initCorner(WHEEL_ITEMS))
  const [wheelRF, setWheelRF] = useState(initCorner(WHEEL_ITEMS))
  const [wheelLR, setWheelLR] = useState(initCorner(WHEEL_ITEMS))
  const [wheelRR, setWheelRR] = useState(initCorner(WHEEL_ITEMS))
  const [steerLF, setSteerLF] = useState(initSteer(STEERING_ITEMS))
  const [steerRF, setSteerRF] = useState(initSteer(STEERING_ITEMS))
  const [steerLR, setSteerLR] = useState(initSteer(STEERING_ITEMS))
  const [steerRR, setSteerRR] = useState(initSteer(STEERING_ITEMS))
  const [hitchItems,  setHitchItems]  = useState(initItems(HITCH_ITEMS))
  const [wiringItems, setWiringItems] = useState(initItems(WIRING_ITEMS))
  const [underItems,  setUnderItems]  = useState(initItems(UNDER_ITEMS))
  const [aboveItems,  setAboveItems]  = useState(initItems(ABOVE_ITEMS))

  useEffect(() => { db.equipment.get(id).then(setEq) }, [id])

  function updateItem(setter, item, val) {
    setter(prev => ({ ...prev, items: { ...prev.items, [item]: val } }))
  }
  function updateCorner(setter, field, val) {
    setter(prev => ({ ...prev, [field]: val }))
  }

  async function submit() {
    if (!tech.trim()) { alert('Please enter technician name.'); return }
    setSaving(true)
    const formData = {
      ro_number: ro, ada_compliant: ada,
      wheel_assembly: { left_front: wheelLF, right_front: wheelRF, left_rear: wheelLR, right_rear: wheelRR },
      steering_system: { left_front: steerLF, right_front: steerRF, left_rear: steerLR, right_rear: steerRR },
      hitch_system: hitchItems, wiring_system: wiringItems,
      under_tram: underItems, above_tram: aboveItems,
      general_comments: generalComments,
      tech_signature: techSig, tech_sig_date: techSigDate,
      supervisor_signature: supSig, supervisor_sig_date: supSigDate,
    }
    await saveRecord({
      equipment_id: id, technician_name: tech, service_date: date,
      status, inspection_notes: generalComments || 'Inspection completed',
      parts_replaced: [], created_by: user?.id,
      record_type: 'inspection', form_data: formData,
    })
    navigate(`/equipment/${id}`)
  }

  if (!eq) return <div className="empty">Loading…</div>

  return (
    <div className="page">
      <button className="back" onClick={() => navigate(`/equipment/${id}`)}>← Back</button>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>Tram Inspection</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1.5rem' }}>
        {eq.name}{eq.model ? ` — ${eq.model}` : ''} · {eq.serial_number || eq.qr_id}
      </div>

      {/* Vehicle & Technician Info */}
      <FormSectionHeader title="Vehicle & Technician Info" />
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
          <FormField label="Technician Name">
            <input value={tech} onChange={e => setTech(e.target.value)} placeholder="Enter name" />
          </FormField>
          <FormField label="Date">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </FormField>
          <FormField label="Serial #">
            <input value={eq.serial_number || ''} readOnly style={{ opacity: 0.6 }} />
          </FormField>
          <FormField label="Tram #">
            <input value={eq.tram_number || eq.name} readOnly style={{ opacity: 0.6 }} />
          </FormField>
          <FormField label="Year">
            <input value={eq.model_year || ''} readOnly style={{ opacity: 0.6 }} />
          </FormField>
          <FormField label="Repair Order #">
            <input value={ro} onChange={e => setRo(e.target.value)} placeholder="RO-XXXXX" />
          </FormField>
          <FormField label="ADA Compliant">
            <ADARadio value={ada} onChange={setAda} />
          </FormField>
          <FormField label="Overall Status">
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="in_service">In Service</option>
              <option value="out_of_service">Out of Service</option>
              <option value="pending">Pending</option>
            </select>
          </FormField>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, padding: '10px 16px', background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 8, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <LegendDot color="#22c55e" label="Checked & OK" />
        <LegendDot color="#f59e0b" label="May Need Future Attention" />
        <LegendDot color="#ef4444" label="Requires Immediate Attention" />
      </div>

      {/* Wheel Assembly */}
      <FormSectionHeader title="Wheel Assembly & Tires" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>
        {[['Left Front', wheelLF, setWheelLF], ['Right Front', wheelRF, setWheelRF],
          ['Left Rear',  wheelLR, setWheelLR], ['Right Rear',  wheelRR, setWheelRR]
        ].map(([label, state, setter]) => (
          <WheelCard key={label} label={label} items={WHEEL_ITEMS} state={state}
            onItemChange={(item, val) => updateItem(setter, item, val)}
            onFieldChange={(field, val) => updateCorner(setter, field, val)}
          />
        ))}
      </div>

      {/* Steering System */}
      <FormSectionHeader title="Steering System" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>
        {[['Left Front', steerLF, setSteerLF], ['Right Front', steerRF, setSteerRF],
          ['Left Rear',  steerLR, setSteerLR], ['Right Rear',  steerRR, setSteerRR]
        ].map(([label, state, setter]) => (
          <CheckCard key={label} label={label} items={STEERING_ITEMS} state={state}
            onItemChange={(item, val) => updateItem(setter, item, val)}
            onCommentChange={val => updateCorner(setter, 'comments', val)}
          />
        ))}
      </div>

      {/* Single-table sections */}
      {[
        ['Hitch System',   HITCH_ITEMS,  hitchItems,  setHitchItems],
        ['Wiring System',  WIRING_ITEMS, wiringItems, setWiringItems],
        ['Under Tram',     UNDER_ITEMS,  underItems,  setUnderItems],
        ['Above Tram',     ABOVE_ITEMS,  aboveItems,  setAboveItems],
      ].map(([title, items, state, setter]) => (
        <div key={title} style={{ marginBottom: '1.5rem' }}>
          <FormSectionHeader title={title} />
          <SimpleCheckCard items={items} state={state}
            onChange={(item, val) => setter(prev => ({ ...prev, [item]: val }))}
          />
        </div>
      ))}

      {/* Comments */}
      <FormSectionHeader title="Comments / Notes" />
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <textarea value={generalComments} onChange={e => setGeneralComments(e.target.value)}
          placeholder="Enter any general comments, observations, or additional notes about this inspection…"
          style={{ minHeight: 110 }}
        />
      </div>

      {/* Signatures */}
      <FormSectionHeader title="Signatures" />
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
          <FormField label="Technician Signature">
            <input value={techSig} onChange={e => setTechSig(e.target.value)} placeholder="Type full name as signature" />
          </FormField>
          <FormField label="Technician Date">
            <input type="date" value={techSigDate} onChange={e => setTechSigDate(e.target.value)} />
          </FormField>
          <FormField label="Supervisor Signature">
            <input value={supSig} onChange={e => setSupSig(e.target.value)} placeholder="Type full name as signature" />
          </FormField>
          <FormField label="Supervisor Date">
            <input type="date" value={supSigDate} onChange={e => setSupSigDate(e.target.value)} />
          </FormField>
        </div>
      </div>

      <button className="primary" onClick={submit} disabled={saving} style={{ marginBottom: '2rem' }}>
        {saving ? 'Saving…' : 'Submit Inspection'}
      </button>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────

export function FormSectionHeader({ title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface2)', borderLeft: '4px solid var(--accent)', padding: '10px 16px', marginBottom: 8, borderRadius: '0 6px 6px 0' }}>
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>{title}</span>
    </div>
  )
}

export function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text2)' }}>{label}</div>
      {children}
    </div>
  )
}

function ADARadio({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 16, paddingTop: 4 }}>
      {['yes', 'no'].map(opt => (
        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
          <input type="radio" name="ada-insp" value={opt} checked={value === opt} onChange={() => onChange(opt)}
            style={{ accentColor: 'var(--accent)', width: 18, height: 18 }} />
          {opt.charAt(0).toUpperCase() + opt.slice(1)}
        </label>
      ))}
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      {label}
    </div>
  )
}

function RadioCell({ name, value, checked, onChange, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)}
        style={{ appearance: 'none', WebkitAppearance: 'none', width: 28, height: 28,
          border: `2px solid ${checked ? color : 'var(--border)'}`, borderRadius: '50%',
          cursor: 'pointer', background: checked ? color : 'transparent', transition: 'all 0.15s',
          boxShadow: checked ? `0 0 0 3px ${color}33` : 'none' }}
      />
    </div>
  )
}

function CheckRow({ item, namePrefix, value, onChange }) {
  const name = `${namePrefix}-${item}`
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 38px 38px 38px', alignItems: 'center', padding: '6px 12px', borderBottom: '0.5px solid var(--border)', minHeight: 44 }}>
      <span style={{ fontSize: 13, color: 'var(--text1)', paddingRight: 8, lineHeight: 1.3 }}>{item}</span>
      <RadioCell name={name} value="ok"     checked={value === 'ok'}     onChange={onChange} color="#22c55e" />
      <RadioCell name={name} value="warn"   checked={value === 'warn'}   onChange={onChange} color="#f59e0b" />
      <RadioCell name={name} value="danger" checked={value === 'danger'} onChange={onChange} color="#ef4444" />
    </div>
  )
}

function TableHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 38px 38px 38px', padding: '6px 12px', background: 'var(--surface2)', borderBottom: '0.5px solid var(--border)' }}>
      <span style={{ fontSize: 10, color: 'var(--text2)', textTransform: 'uppercase', fontWeight: 600 }}>Item</span>
      <span style={{ fontSize: 10, color: '#22c55e', textAlign: 'center', fontWeight: 600 }}>OK</span>
      <span style={{ fontSize: 10, color: '#f59e0b', textAlign: 'center', fontWeight: 600 }}>Warn</span>
      <span style={{ fontSize: 10, color: '#ef4444', textAlign: 'center', fontWeight: 600 }}>Urgent</span>
    </div>
  )
}

function WheelCard({ label, items, state, onItemChange, onFieldChange }) {
  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: 'var(--surface2)', padding: '8px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text2)', borderBottom: '0.5px solid var(--border)' }}>{label}</div>
      <TableHeader />
      {items.map(item => (
        <CheckRow key={item} item={item} namePrefix={`wheel-${label}`} value={state.items[item]} onChange={val => onItemChange(item, val)} />
      ))}
      <div style={{ padding: '8px 12px', borderTop: '0.5px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13 }}>Tire Pressure (PSI)</span>
        <input type="number" value={state.tire_pressure} onChange={e => onFieldChange('tire_pressure', e.target.value)} placeholder="PSI" style={{ textAlign: 'center', padding: '6px 8px', fontSize: 13 }} />
      </div>
      <div style={{ padding: '8px 12px', display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, alignItems: 'center', borderTop: '0.5px solid var(--border)' }}>
        <span style={{ fontSize: 13 }}>Alignment</span>
        <select value={state.alignment} onChange={e => onFieldChange('alignment', e.target.value)} style={{ padding: '6px 8px', fontSize: 13 }}>
          <option value="">Select…</option>
          <option>Good</option>
          <option>Off</option>
        </select>
      </div>
      <div style={{ padding: '8px 12px', borderTop: '0.5px solid var(--border)' }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 6 }}>Comments</div>
        <textarea value={state.comments} onChange={e => onFieldChange('comments', e.target.value)} placeholder={`Notes for ${label.toLowerCase()}…`} style={{ minHeight: 56, fontSize: 13 }} />
      </div>
    </div>
  )
}

function CheckCard({ label, items, state, onItemChange, onCommentChange }) {
  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: 'var(--surface2)', padding: '8px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text2)', borderBottom: '0.5px solid var(--border)' }}>{label}</div>
      <TableHeader />
      {items.map(item => (
        <CheckRow key={item} item={item} namePrefix={`steer-${label}`} value={state.items[item]} onChange={val => onItemChange(item, val)} />
      ))}
      <div style={{ padding: '8px 12px', borderTop: '0.5px solid var(--border)' }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 6 }}>Comments</div>
        <textarea value={state.comments} onChange={e => onCommentChange(e.target.value)} placeholder="Notes…" style={{ minHeight: 56, fontSize: 13 }} />
      </div>
    </div>
  )
}

function SimpleCheckCard({ items, state, onChange }) {
  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <TableHeader />
      {items.map(item => (
        <CheckRow key={item} item={item} namePrefix="simple" value={state[item]} onChange={val => onChange(item, val)} />
      ))}
    </div>
  )
}
