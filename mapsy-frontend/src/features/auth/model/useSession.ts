import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { getSupabase, isSupabaseConfigured } from '@/shared/api/supabase'

/**
 * Current auth session — PRD §3.
 *
 * `unconfigured` is a first-class state rather than an error. Without it the app
 * would be unusable until a Supabase project exists, which would make the UI
 * impossible to work on; screens treat it as "preview mode" and render anyway.
 *
 * `loading` matters because `getSession` reads the persisted token
 * asynchronously. Collapsing it into `anonymous` would bounce an already
 * signed-in user to the login screen for a frame on every cold start.
 */
export type SessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; session: Session }
  | { status: 'anonymous' }
  | { status: 'unconfigured' }

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(() =>
    isSupabaseConfigured ? { status: 'loading' } : { status: 'unconfigured' },
  )

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const supabase = getSupabase()
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      // onAuthStateChange may have already resolved by the time this lands; the
      // flag stops the slower answer from overwriting the fresher one.
      if (!active) return
      setState(
        data.session ? { status: 'authenticated', session: data.session } : { status: 'anonymous' },
      )
    })

    // Also fires when the OAuth redirect returns with a session in the URL,
    // which is what actually completes the Google sign-in round trip.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? { status: 'authenticated', session } : { status: 'anonymous' })
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return state
}
