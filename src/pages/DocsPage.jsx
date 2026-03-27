import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STORAGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents`

const DOCS = {
  master_ops_doc: {
    title: 'Master Ops Doc',
    url: 'https://docs.google.com/document/d/1UxVvA_UKqpgSMCvBaHvL5mZphRSVgZc0/edit?usp=sharing&ouid=107508318059145291753&rtpof=true&sd=true',
  },
  technical_documents: [
    { title: 'Model SB Standard', url: `${STORAGE_BASE}/FlexTram_Technical_Drawings_Dimensions_app_ref.pdf` },
    { title: 'Model SB Standard Wiring Diagram', url: `${STORAGE_BASE}/flextram_wiring_diagram_app_ref.pdf` },
    { title: 'Approved Tow Vehicles', url: `${STORAGE_BASE}/FlexTram_Tow_Vehicles_Maintenance_app_ref.pdf` },
    { title: 'Trailer Loading', url: `${STORAGE_BASE}/trailer_load_plan_app_ref.pdf` },
  ],
  operating_procedures: [
    { title: 'Shipping',   url: 'https://docs.google.com/document/d/1KPwzJ-0Hyd6gpnggBzDLff5xXMoFwI2J/edit?usp=sharing&ouid=107508318059145291753&rtpof=true&sd=true' },
    { title: 'Receiving',  url: 'https://docs.google.com/document/d/1pG6Mz9DViKkxAXbFUlqcOMuVlqEi4hz3/edit?usp=sharing&ouid=107508318059145291753&rtpof=true&sd=true' },
    { title: 'Event Days', url: 'https://docs.google.com/document/d/1TCgNANjoB4LCde89Ui0L21gRdYCUSHFK/edit?usp=sharing&ouid=107508318059145291753&rtpof=true&sd=true' },
    { title: 'Tram Rodeo', url: 'https://drive.google.com/file/d/1wwLDRyvtSnDccY8h7b7wWPqo9bnsEPcW/view?usp=sharing' },
  ],
}

export default function DocsPage() {
  const navigate = useNavigate()
  const [openSection, setOpenSection] = useState(null)

  function toggleSection(key) {
    setOpenSection(prev => prev === key ? null : key)
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0f1a', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0a0f1a', padding: '18px 20px 14px', borderBottom: '0.5px solid #1e293b', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'transparent', border: 'none', color: '#475569', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1, marginRight: 4 }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.3px' }}>Reference Docs</div>
          <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Flextram Fleet</div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 20px' }}>

        {/* Section label */}
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#334155', marginBottom: 12 }}>
          Global Documents
        </div>

        {/* Master Ops Doc — direct link button */}
        <a
          href={DOCS.master_ops_doc.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', background: 'transparent', color: '#f59e0b',
            border: '1px solid #f59e0b', borderRadius: 10, padding: '12px 16px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
            marginBottom: 24, boxSizing: 'border-box',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            📄 {DOCS.master_ops_doc.title}
          </span>
          <span style={{ fontSize: 13, opacity: 0.7 }}>Open →</span>
        </a>

        {/* Section label */}
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#334155', marginBottom: 12 }}>
          Technical Reference
        </div>

        {/* Technical Documents — dropdown */}
        <Accordion
          label="Technical Documents"
          icon="📐"
          items={DOCS.technical_documents}
          isOpen={openSection === 'technical_documents'}
          onToggle={() => toggleSection('technical_documents')}
        />

        {/* Operating Procedures — dropdown */}
        <Accordion
          label="Operating Procedures"
          icon="📋"
          items={DOCS.operating_procedures}
          isOpen={openSection === 'operating_procedures'}
          onToggle={() => toggleSection('operating_procedures')}
        />

      </div>
    </div>
  )
}

function Accordion({ label, icon, items, isOpen, onToggle }) {
  return (
    <div style={{ marginBottom: 10, border: '0.5px solid #1e293b', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header row */}
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width: '100%', background: '#0f172a', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', boxSizing: 'border-box',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
          <span aria-hidden="true">{icon}</span> {label}
        </span>
        <span aria-hidden="true" style={{ fontSize: 13, color: '#475569', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▾
        </span>
      </button>

      {/* Items */}
      {isOpen && (
        <div style={{ borderTop: '0.5px solid #1e293b' }}>
          {items.map((item, i) => (
            item.url === '#' ? (
              <div
                key={i}
                aria-disabled="true"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 16px',
                  borderBottom: i < items.length - 1 ? '0.5px solid #1e293b' : 'none',
                  fontSize: 14, color: '#475569',
                }}
              >
                <span>{item.title}</span>
                <span style={{ fontSize: 11, color: '#334155' }}>Coming soon</span>
              </div>
            ) : (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 16px',
                  borderBottom: i < items.length - 1 ? '0.5px solid #1e293b' : 'none',
                  textDecoration: 'none', fontSize: 14, color: '#f1f5f9',
                }}
              >
                <span>{item.title}</span>
                <span style={{ fontSize: 13, color: '#f59e0b' }}>Open →</span>
              </a>
            )
          ))}
        </div>
      )}
    </div>
  )
}
