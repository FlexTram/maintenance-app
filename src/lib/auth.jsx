import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { syncEquipmentCache, syncRecordsFromSupabase, flushPendingRecords } from '../lib/sync'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) onSignIn()
      setLoading(false)
    })

    // Listen for auth state changes (sign in / sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) onSignIn()
    })

    return () => subscription.unsubscribe()
  }, [])

  // On sign-in: cache equipment list and pull down any records
  async function onSignIn() {
    await syncEquipmentCache()
    await syncRecordsFromSupabase()
    await flushPendingRecords()
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      }
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
