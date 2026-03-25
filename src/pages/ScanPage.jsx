import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { getEquipmentByQrId, getEquipmentByIdentifier } from '../lib/sync'
import { StatusBadge } from './HomePage'

export default function ScanPage() {
  const navigate   = useNavigate()
  const scannerRef = useRef(null)
  const [status,   setStatus]   = useState('idle') // idle | scanning | found | error
  const [message,  setMessage]  = useState('')
  const [equipment, setEquipment] = useState(null)

  useEffect(() => {
    startScanner()
    return () => stopScanner()
  }, [])

  async function startScanner() {
    setStatus('scanning')
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {} // ignore per-frame errors
      )
    } catch {
      setStatus('error')
      setMessage('Camera access denied. Please allow camera permission and try again.')
    }
  }

  async function stopScanner() {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      }
    } catch {}
  }

  async function onScanSuccess(qrValue) {
    await stopScanner()
    setStatus('found')
    setMessage(`QR code: ${qrValue}`)

    const eq = await getEquipmentByQrId(qrValue)
    if (eq) {
      setEquipment(eq)
    } else {
      setStatus('error')
      setMessage(`No equipment found for QR code "${qrValue}". Check that this equipment is in the database.`)
    }
  }

  function retry() {
    setStatus('idle')
    setMessage('')
    setEquipment(null)
    startScanner()
  }

  return (
    <div className="page">
      <button className="back" onClick={() => navigate('/')}>← Back</button>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: '1rem' }}>Scan QR Code</div>

      {/* Camera viewfinder */}
      {status === 'scanning' && (
        <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '1rem', background: '#000' }}>
          <div id="qr-reader" style={{ width: '100%' }} />
        </div>
      )}

      {status === 'scanning' && (
        <p style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', marginBottom: '1rem' }}>
          Point your camera at the QR code on the equipment
        </p>
      )}

      {/* Result */}
      {status === 'found' && equipment && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontWeight: 500 }}>{equipment.name}{equipment.model ? ` — ${equipment.model}` : ''}</div>
            <StatusBadge status={equipment.status || 'in_service'} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>
            {equipment.serial_number || equipment.qr_id}
          </div>
          <div className="stack">
            <button className="primary" onClick={() => navigate(`/equipment/${equipment.id}`)}>
              View equipment record
            </button>
            <button onClick={() => navigate(`/equipment/${equipment.id}/new/inspection`)}>
              + Log Inspection
            </button>
            <button onClick={() => navigate(`/equipment/${equipment.id}/new/repair`)}>
              + Log Repair
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="card">
          <div style={{ color: 'var(--fail-text)', fontSize: 14, marginBottom: '1rem' }}>{message}</div>
          <button onClick={retry}>Try again</button>
        </div>
      )}

      {/* Manual entry fallback */}
      <div style={{ marginTop: '1.5rem' }}>
        <div className="section-label">Can't scan?</div>
        <ManualEntry onFound={(eq) => {
          setStatus('found')
          setEquipment(eq)
        }} onError={(msg) => {
          setStatus('error')
          setMessage(msg)
        }} />
      </div>
    </div>
  )
}

function ManualEntry({ onFound, onError }) {
  const [value, setValue] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!value.trim()) return
    const eq = await getEquipmentByIdentifier(value.trim())
    if (eq) {
      onFound(eq)
    } else {
      onError(`No tram found for "${value.trim()}". Try a tram number, serial number, or QR ID.`)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
      <input
        type="text"
        placeholder="Tram #, Serial Number, or QR ID"
        value={value}
        onChange={e => setValue(e.target.value)}
        style={{ flex: 1 }}
      />
      <button type="submit" style={{ width: 'auto', padding: '10px 14px' }}>Go</button>
    </form>
  )
}
