import { getSupabase } from '@/shared/api/supabase'

/**
 * Ends the session — PRD §6.4.
 *
 * No navigation here: `useSession`'s `onAuthStateChange` listener sees the
 * session go, `AppLayout` re-renders as the gate, and the redirect to /login
 * happens where every other unauthenticated visit is handled. A `navigate` call
 * beside this one would be a second route for the same event, and the two would
 * disagree the first time sign-out failed.
 */
export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut()
  if (error) throw error
}
