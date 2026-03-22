import { useAuth } from '../lib/auth'
import { Navigate } from 'react-router-dom'

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()

  if (loading) return <div className="empty">Loading…</div>
  if (user)    return <Navigate to="/" replace />

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <img
          src="/flextram.png"
          alt="Can You Maintain? Flextram"
          style={{ width: '100%', borderRadius: 16, marginBottom: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        />
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
