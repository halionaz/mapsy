import { useSession } from './useSession'

/**
 * The signed-in user's id, or null in preview mode.
 *
 * Every write needs it (rows carry `user_id` and storage paths start with it),
 * and screens behind AppLayout can rely on it being present whenever Supabase is
 * configured — the gate has already run by then.
 */
export function useCurrentUserId(): string | null {
  const session = useSession()
  return session.status === 'authenticated' ? session.session.user.id : null
}
