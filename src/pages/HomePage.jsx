import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getAllRecords, getAllEquipment } from '../lib/sync'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [recent,    setRecent]    = useState([])
  const [stats,     setStats]     = useState({ inService: 0, outOfService: 0 })
  const [globalDocs, setGlobalDocs] = useState([])

  useEffect(() => {
    async function load() {
      const [recs, equip] = await Promise.all([getAllRecords(), getAllEquipment()])

      const latestByEquip = {}
      for (const r of recs) {
        if (!latestByEquip[r.equipment_id]) latestByEquip[r.equipment_id] = r
      }
      let inService = 0, outOfService = 0
      Object.values(latestByEquip).forEach(r => {
        if (r.status === 'in_service') inService++
        else if (r.status === 'out_of_service') outOfService++
      })
      setStats({ inService, outOfService })

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
    if (user) {
      supabase.from('documents').select('*').is('equipment_id', null).then(({ data, error }) => {
        if (error) console.error('docs fetch error:', error)
        if (data) setGlobalDocs(data)
      })
    }
  }, [user])

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0f1a', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ background: '#0a0f1a', padding: '18px 20px 14px', borderBottom: '0.5px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/icons/icon-192.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Flextram" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.3px' }}>FLEXTRAM</div>
            <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Maintenance</div>
          </div>
        </div>
        <button onClick={signOut} style={{ fontSize: 12, color: '#475569', border: '0.5px solid #1e293b', borderRadius: 6, padding: '5px 10px', background: 'transparent', cursor: 'pointer', width: 'auto' }}>
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 20px' }}>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#f1f5f9', marginBottom: 2 }}>Hi, {firstName}</div>
          <div style={{ fontSize: 13, color: '#475569' }}>Here's your equipment overview</div>
        </div>

        <img
          src="/heavy_repairs_homepage.png"
          alt="Heavy Repairs"
          style={{ width: '100%', borderRadius: 10, marginBottom: 10, display: 'block', paddingTop: 5, paddingBottom: 5 }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div className="stat-card in-service"
            onClick={() => navigate('/records?filter=in_service')}
            onPointerDown={e => e.currentTarget.classList.add('active')}
            onPointerUp={e => e.currentTarget.classList.remove('active')}
            onPointerLeave={e => e.currentTarget.classList.remove('active')}
          >
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>In service</div>
            <div style={{ fontSize: 26, fontWeight: 600, color: '#4ade80' }}>{stats.inService}</div>
          </div>
          <div className="stat-card out-of-service"
            onClick={() => navigate('/records?filter=out_of_service')}
            onPointerDown={e => e.currentTarget.classList.add('active')}
            onPointerUp={e => e.currentTarget.classList.remove('active')}
            onPointerLeave={e => e.currentTarget.classList.remove('active')}
          >
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Out of service</div>
            <div style={{ fontSize: 26, fontWeight: 600, color: '#f87171' }}>{stats.outOfService}</div>
          </div>
        </div>

        <button
          onClick={() => navigate('/scan')}
          style={{ width: '100%', background: '#f59e0b', color: '#0a0f1a', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 700, marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          Scan QR Code or Enter VIN Manually
        </button>

        <button
          onClick={() => navigate('/records')}
          style={{ width: '100%', background: 'transparent', color: '#94a3b8', border: '0.5px solid #1e293b', borderRadius: 10, padding: 11, fontSize: 14, marginBottom: 8, cursor: 'pointer' }}
        >
          View all records
        </button>

        <button
          onClick={() => navigate('/docs')}
          style={{ width: '100%', background: 'transparent', color: '#94a3b8', border: '0.5px solid #1e293b', borderRadius: 10, padding: 11, fontSize: 14, marginBottom: 8, cursor: 'pointer' }}
        >
          Quick Document Reference
        </button>

        {globalDocs.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {globalDocs.map(doc => (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ background: 'transparent', color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: 10, padding: '9px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, lineHeight: 1.3 }}
              >
                📄 {doc.title}
              </a>
            ))}
          </div>
        )}

        {recent.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#334155', marginBottom: 10 }}>
              Recently serviced
            </div>
            {recent.map(({ eq, lastRecord }) => (
              <div
                key={eq.id}
                onClick={() => navigate(`/equipment/${eq.id}`)}
                style={{ border: '0.5px solid #1e293b', borderRadius: 10, padding: 12, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 12, background: '#0f172a', cursor: 'pointer' }}
              >
                <div style={{ width: 36, height: 36, background: '#1e293b', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {eq.icon || '⚙️'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{eq.name}</div>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    {eq.qr_id} · {new Date(lastRecord.service_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <StatusBadge status={lastRecord.status} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export function StatusBadge({ status }) {
  const styles = {
    in_service:     { background: '#052e16', color: '#4ade80', label: 'In service' },
    out_of_service: { background: '#450a0a', color: '#f87171', label: 'Out of service' },
    pending:        { background: '#431407', color: '#fb923c', label: 'Pending' },
  }
  const s = styles[status] || { background: '#1e293b', color: '#94a3b8', label: status }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: s.background, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}
