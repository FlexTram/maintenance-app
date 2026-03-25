import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGlobalDocuments } from '../lib/sync'

const CATEGORY_LABELS = {
  master_ops_doc:        'Master Ops Doc',
  approved_tow_vehicles: 'Approved Tow Vehicles',
  technical_drawing:     'Technical Drawings',
  service_procedure:     'Operating Procedures',
}

export default function DocsPage() {
  const navigate  = useNavigate()
  const [docs,    setDocs]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const data = await getGlobalDocuments()
      setDocs(data)
      setLoading(false)
    }
    load()
  }, [])

  const categories = ['master_ops_doc', 'approved_tow_vehicles', 'technical_drawing', 'service_procedure']

  return (
    <div className="page">
      <button className="back" onClick={() => navigate('/')}>← Home</button>
      <div style={{ fontWeight: 600, fontSize: 18, marginBottom: '1.5rem' }}>Reference Docs</div>

      {loading && <div className="empty">Loading…</div>}

      {!loading && categories.map(category => {
        const categoryDocs = docs.filter(d => d.category === category)
        return (
          <div key={category} style={{ marginBottom: '1.5rem' }}>
            <div className="section-label">{CATEGORY_LABELS[category]}</div>
            {categoryDocs.length === 0 ? (
              <div className="empty">No documents added yet.</div>
            ) : (
              <div className="card">
                {categoryDocs.map((doc, i) => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 0',
                      borderBottom: i < categoryDocs.length - 1 ? '0.5px solid var(--border)' : 'none',
                      textDecoration: 'none',
                      color: 'var(--text1)',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{doc.title}</span>
                    <span style={{ fontSize: 13, color: 'var(--accent)' }}>Open →</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
