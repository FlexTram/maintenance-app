import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getAllRecords, getAllEquipment } from '../lib/sync'

export default function HomePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [recent,    setRecent]    = useState([])
  const [equipment, setEquipment] = useState([])

  useEffect(() => {
    async function load() {
      const [recs, equip] = await Promise.all([getAllRecords(), getAllEquipment()])
      setEquipment(equip)

      // Build recent list: unique equipment sorted by most recent record
      const seen = new Set()
      const recentEquip = []
      for (const r of recs) {
        if (!seen.has(r.equipment_id)) {
          seen.add(r.equipment_id)
          const eq = equip.find(e => e.id === r.equipment_id)
          if (eq) recentEquip.push({ eq, lastRecord: r })
        }
        if (recentEquip.length >= 4) break
      }
      setRecent(recentEquip)
    }
    load()
  }, [])

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>Hi, {firstName}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{equipment.length} pieces of equipment</div>
        </div>
        <button onClick={signOut} style={{ width: 'auto', padding: '6px 12px', fontSize: 13, color: 'var(--text2)' }}>
          Sign out
        </button>
      </div>

      {/* Primary action */}
      <button
        className="primary"
        style={{ fontSize: 16, padding: '14px', marginBottom: '1rem' }}
        onClick={() => navigate('/scan')}
      >
        Scan QR Code
      </button>

      <div className="stack" style={{ marginBottom: '1.5rem' }}>
        <button onClick={() => navigate('/records')}>View all records</button>
      </div>

      {/* Recent equipment */}
      {recent.length > 0 && (
        <>
          <div className="section-label">Recently serviced</div>
          <div className="stack">
            {recent.map(({ eq, lastRecord }) => (
              <div
                key={eq.id}
                className="record"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                onClick={() => navigate(`/equipment/${eq.id}`)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{eq.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {eq.qr_id} · {new Date(lastRecord.service_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <span style={{ color: 'var(--text3)' }}>›</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
