import { useAuth } from '../lib/auth'
import { Navigate } from 'react-router-dom'

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()

  if (loading) return <div className="empty">Loading…</div>
  if (user)    return <Navigate to="/" replace />

  return (
    <div className="login-page">
      <div className="login-box">
        <img src="/flextram.jpg" alt="Flextram - Can You Maintain?" className="login-hero" />
        <button className="login-btn" onClick={signInWithGoogle}>
          Continue with Google
        </button>
        <p className="login-hint">Sign in with your work Google account</p>
      </div>
    </div>
  )
}
