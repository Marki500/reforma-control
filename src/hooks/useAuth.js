import { useState, useEffect } from 'react'
import { supabase } from '../services/supabaseClient'
import { clearWorkspaceCache } from '../services/workspaceService'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      clearWorkspaceCache()
      setUser(session?.user ?? null)
      setLoading(false)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => listener?.subscription.unsubscribe()
  }, [])

  return { user, loading }
}
