import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { saveRecord, editRecord } from '../lib/sync'
import { useAuth } from '../lib/auth'
import { FormSectionHeader, FormField, FormSubmitBar, ADARadio } from './InspectionForm'

const REPAIR_SECTIONS = [
  { key: 'wheel_assembly',  label: 'Wheel Assembly & Tires', placeholder: 'Describe repairs made to wheel assembly and tires…' },
  { key: 'wiring_system',   label: 'Wiring System',          placeholder: 'Describe repairs made to the wiring system…' },
  { key: 'steering_system', label: 'Steering System',        placeholder: 'Describe repairs made to the steering system…' },
  { key: 'under_tram',      label: 'Under Tram',             placeholder: 'Describe repairs made under the tram…' },
  { key: 'hitch_system',    label: 'Hitch System',           placeholder: 'Describe repairs made to the hitch system…' },
  { key: 'above_tram',      label: 'Above Tram',             placeholder: 'Describe repairs made above the tram…' },
]

export default function RepairForm() {
  const { id, recordId } = useParams()
  const isEditMode = !!recordId
  const navigate = useNavigate()
  const { user } = useAuth()
  const [eq, setEq]         = useState(null)
  const [existingRecord, setExistingRecord] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState([])

  const [tech, setTech]     = useState(user?.user_metadata?.full_name || '')
  const [date, setDate]     = useState(new Date().toISOString().split('T')[0])
  const [ro, setRo]         = useState('')
  const [ada, setAda]       = useState('')
  const [status, setStatus] = useState('in_service')
  const [repairs, setRepairs] = useState(Object.fromEntries(REPAIR_SECTIONS.map(s => [s.key, ''])))
  const [generalComments, setGeneralComments] = useState('')
  const [techSig, setTechSig]         = useState('')
  const [techSigDate, setTechSigDate] = useState(new Date().toISOString().split('T')[0])
  const [supSig, setSupSig]           = useState('')
  const [supSigDate, setSupSigDate]   = useState('')

  useEffect(() => { db.equipment.get(id).then(setEq) }, [id])

  // Pre-populate form when editing an existing record
  useEffect(() => {
    if (!recordId) return
    db.records.where('localId').equals(Number(recordId)).first().then(record => {
      if (!record) return
      setExistingRecord(record)
      setTech(record.technician_name || '')
      setDate(record.service_date || '')
      setRo(record.form_data?.ro_number || '')
      setAda(record.form_data?.ada_compliant || '')
      setStatus(record.status || 'in_service')
      setGeneralComments(record.form_data?.general_comments || '')
      setTechSig(record.form_data?.tech_signature || '')
      setTechSigDate(record.form_data?.tech_sig_date || '')
      setSupSig(record.form_data?.supervisor_signature || '')
      setSupSigDate(record.form_data?.supervisor_sig_date || '')
      const repairData = {}
      REPAIR_SECTIONS.forEach(s => { repairData[s.key] = record.form_data?.[s.key] || '' })
      setRepairs(repairData)
    })
  }, [recordId])

  function formatRO(val) {
    const raw = val.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase()
    if (!raw.startsWith('RO-')) {
      const digits = raw.replace(/^RO-?/i, '').replace(/[^A-Z0-9]/g, '')
      return 'RO-' + digits
    }
    return raw
  }

  async function submit() {
    const errs = []
    if (!tech.trim()) errs.push('Technician Name is required')
    if (!techSig.trim()) errs.push('Technician Signature is required')
    const hasAnyRepair = REPAIR_SECTIONS.some(s => repairs[s.key].trim())
    if (!hasAnyRepair) errs.push('At least one repair section must be filled out')

    if (errs.length) {
      setErrors(errs)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setErrors([])
    setSaving(true)
    try {
      const formData = {
        ro_number: ro, ada_compliant: ada,
        ...repairs,
        general_comments: generalComments,
        tech_signature: techSig, tech_sig_date: techSigDate,
        supervisor_signature: supSig, supervisor_sig_date: supSigDate,
      }
      const summary = REPAIR_SECTIONS
        .filter(s => repairs[s.key].trim())
        .map(s => `${s.label}: ${repairs[s.key]}`)
        .join('; ')

      if (isEditMode && existingRecord) {
        await editRecord(
          existingRecord.localId, existingRecord.id,
          {
            technician_name: tech, service_date: date, status,
            inspection_notes: summary || 'Repair record submitted',
            form_data: formData,
          },
          user?.id, user?.user_metadata?.full_name
        )
      } else {
        const result = await saveRecord({
          equipment_id: id, technician_name: tech, service_date: date,
          status, inspection_notes: summary || 'Repair record submitted',
          parts_replaced: [], created_by: user?.id,
          record_type: 'repair', form_data: formData,
        })
        if (!result.didSync) {
          alert('Record saved to your device but failed to sync to the cloud. It will appear on the home screen for manual sync.')
        }
      }
      navigate(`/equipment/${id}`)
    } catch (err) {
      console.error('Failed to save repair:', err)
      setErrors(['Failed to save — please try again'])
      setSaving(false)
    }
  }

  if (!eq) return <div className="empty">Loading…</div>

  return (
    <div className="page">
      <button className="back" onClick={() => navigate(`/equipment/${id}`)}>← Back</button>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>{isEditMode ? 'Edit Repair Record' : 'Repair Record'}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '1.5rem' }}>
        {eq.name}{eq.model ? ` — ${eq.model}` : ''} · {eq.serial_number || eq.qr_id}
      </div>

      {errors.length > 0 && (
        <div role="alert" style={{ background: '#ef44441a', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>Please fix the following:</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#ef4444', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Vehicle & Technician Info */}
      <FormSectionHeader title="Vehicle & Technician Info" />
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
          <FormField label="Technician Name *">
            <input value={tech} onChange={e => { setTech(e.target.value); setErrors([]) }} placeholder="Enter name"
              style={errors.length && !tech.trim() ? { borderColor: '#ef4444' } : {}} />
          </FormField>
          <FormField label="Repair Date">
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
            <input value={ro} onChange={e => setRo(formatRO(e.target.value))} placeholder="RO-XXXXX" />
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

      {/* Repair Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: '1.5rem' }}>
        {REPAIR_SECTIONS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <FormSectionHeader title={label} />
            <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 6 }}>Repairs</div>
              <textarea value={repairs[key]} onChange={e => setRepairs(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder} style={{ minHeight: 100 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Comments */}
      <FormSectionHeader title="Comments / Notes" />
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <textarea value={generalComments} onChange={e => setGeneralComments(e.target.value)}
          placeholder="Enter any general comments, observations, or additional notes about these repairs…"
          style={{ minHeight: 120 }}
        />
      </div>

      {/* Signatures */}
      <FormSectionHeader title="Signatures" />
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
          <FormField label="Technician Signature *">
            <input value={techSig} onChange={e => { setTechSig(e.target.value); setErrors([]) }} placeholder="Type full name as signature"
              style={errors.length && !techSig.trim() ? { borderColor: '#ef4444' } : {}} />
          </FormField>
          <FormField label="Technician Date">
            <input type="date" value={techSigDate} onChange={e => setTechSigDate(e.target.value)} />
          </FormField>
          <FormField label="Supervisor Signature">
            <input value={supSig} onChange={e => setSupSig(e.target.value)} placeholder="Type full name as signature (optional)" />
          </FormField>
          <FormField label="Supervisor Date">
            <input type="date" value={supSigDate} onChange={e => setSupSigDate(e.target.value)} />
          </FormField>
        </div>
      </div>

      <div style={{ height: 80 }} />

      <FormSubmitBar onCancel={() => navigate(`/equipment/${id}`)} onSubmit={submit} saving={saving}
        submitLabel={isEditMode ? 'Save Changes' : 'Submit Repairs'} />
    </div>
  )
}
