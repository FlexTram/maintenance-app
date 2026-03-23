import { useAuth } from '../lib/auth'
import { Navigate } from 'react-router-dom'

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()

  if (loading) return <div className="empty">Loading…</div>
  if (user)    return <Navigate to="/" replace />

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: '1rem' }}>⚙️</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Maintenance Logger</h1>
        <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: '2rem', lineHeight: 1.6 }}>
          Scan equipment QR codes and log maintenance records — works offline too.
        </p>
        <button className="primary" onClick={signInWithGoogle} style={{ fontSize: 16, padding: '13px' }}>
          Continue with Google
        </button>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: '1rem' }}>
          Sign in with your work Google account
        </p>
      </div>
    </div>
  )
}
