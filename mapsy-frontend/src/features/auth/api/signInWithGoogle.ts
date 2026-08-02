import { getSupabase } from '@/shared/api/supabase'

/**
 * Starts the Google OAuth round trip — PRD §3.
 *
 * Resolves once the browser has been handed off to Google, not once there is a
 * session: the redirect comes back to `redirectTo` and it is `useSession`'s
 * `onAuthStateChange` listener that picks the session up. So a caller can only
 * report a failure to *leave*, never a failure to sign in.
 */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}
