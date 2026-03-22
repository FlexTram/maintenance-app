import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { useEffect, useState } from 'react'
import { flushPendingRecords } from './lib/sync'

import LoginPage    from './pages/LoginPage'
import HomePage     from './pages/HomePage'
import ScanPage     from './pages/ScanPage'
import EquipmentPage from './pages/EquipmentPage'
import NewRecordPage from './pages/NewRecordPage'
import RecordsPage  from './pages/RecordsPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="empty">Loading…</div>
  if (!user)   return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const up   = () => { setIsOnline(true);  flushPendingRecords() }
    const down  = () => setIsOnline(false)
    window.addEventListener('online',  up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  return (
    <>
      {!isOnline && (
        <div className="sync-banner">
          Offline — records will sync when you reconnect
        </div>
      )}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/scan" element={<ProtectedRoute><ScanPage /></ProtectedRoute>} />
        <Route path="/equipment/:id" element={<ProtectedRoute><EquipmentPage /></ProtectedRoute>} />
        <Route path="/equipment/:id/new" element={<ProtectedRoute><NewRecordPage /></ProtectedRoute>} />
        <Route path="/records" element={<ProtectedRoute><RecordsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
