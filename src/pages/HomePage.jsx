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
      <div className="home-header">
        <div>
          <div className="home-greeting">Hi, {firstName}</div>
          <div className="home-subtext">{equipment.length} pieces of equipment</div>
        </div>
        <button className="btn-signout" onClick={signOut}>Sign out</button>
      </div>

      <button className="primary home-scan-btn" onClick={() => navigate('/scan')}>
        Scan QR Code
      </button>

      <div className="stack home-actions">
        <button onClick={() => navigate('/records')}>View all records</button>
      </div>

      {recent.length > 0 && (
        <>
          <div className="section-label">Recently serviced</div>
          <div className="stack">
            {recent.map(({ eq, lastRecord }) => (
              <div
                key={eq.id}
                className="record record-row"
                onClick={() => navigate(`/equipment/${eq.id}`)}
              >
                <div className="record-info">
                  <div className="record-name">{eq.name}</div>
                  <div className="record-meta">
                    {eq.qr_id} · {new Date(lastRecord.service_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <span className="record-chevron">›</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
