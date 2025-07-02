// hooks/useSession.js

import { useState, useEffect } from 'react'
import supabase from '../utils/supabaseClient'

export default function useSession() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    const loadSession = async () => {
      const session = supabase.auth.session()
setSession(session)

    }
    loadSession()
  }, [])

  return session
}
