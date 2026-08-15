import { getSupabase } from '@/shared/api/supabase'
import { warnIfTruncated } from '@/shared/api/warnIfTruncated'
import type { WearEntry } from '../model/types'

/**
 * Supabase access for the wear log.
 *
 * Like `itemApi`, reads and writes carry no owner condition — the policy scopes
 * every row to `auth.uid()`, and repeating that here would suggest the security
 * lives in the client.
 *
 * `removeWear` is the exception, and not for the reason `deleteItem` is: it
 * names `item_id` and `worn_on` because that pair *is* the row's identity. There
 * is no id to delete by, which is the same fact the unique constraint states.
 */

/**
 * Ceiling on the full fetch. See `warnIfTruncated` for why `count: 'exact'` is
 * what detects a short answer rather than this limit.
 *
 * Four garments a day for ten years is about 14,600 rows, so this sits past any
 * wardrobe that is still worth loading whole. Reaching it means the same thing
 * the item ceiling means: the client-side bet has been outgrown.
 */
const WEAR_FETCH_LIMIT = 20000

export async function fetchWears(): Promise<WearEntry[]> {
  // Two columns, not `*`. This is the one query whose row count grows without
  // limit — every other table is bounded by how many garments a person owns —
  // so the three columns nothing reads (`id`, `user_id`, `created_at`) are three
  // columns' worth of payload on every load, forever.
  const { data, error, count } = await getSupabase()
    .from('item_wears')
    .select('item_id, worn_on', { count: 'exact' })
    .order('worn_on', { ascending: false })
    .limit(WEAR_FETCH_LIMIT)

  if (error) throw error
  warnIfTruncated(data?.length ?? 0, count, '착용 기록')

  return (data ?? []).map((row) => ({ itemId: row.item_id, wornOn: row.worn_on }))
}

/**
 * Rewrites one day to exactly this set of garments.
 *
 * Through the database function rather than a delete followed by an insert:
 * each PostgREST request is its own transaction, so a delete that lands while
 * the insert fails is the day's record wiped with nothing to retry from. The
 * function does both or neither — see the migration.
 */
export async function setWears(wornOn: string, itemIds: string[]): Promise<void> {
  const { error } = await getSupabase().rpc('set_item_wears', {
    p_worn_on: wornOn,
    p_item_ids: itemIds,
  })
  if (error) throw error
}

/**
 * Records one garment on one day.
 *
 * `upsert` with `ignoreDuplicates`, not `insert`. The unique constraint makes
 * recording the same day twice a no-op by design, and an ordinary insert would
 * turn that no-op into a 23505 the caller has to recognise and swallow — which
 * is a race the detail screen can lose honestly, by being open on two devices.
 */
export async function addWear(itemId: string, userId: string, wornOn: string): Promise<void> {
  const { error } = await getSupabase()
    .from('item_wears')
    .upsert(
      { item_id: itemId, user_id: userId, worn_on: wornOn },
      { onConflict: 'item_id,worn_on', ignoreDuplicates: true },
    )
  if (error) throw error
}

export async function removeWear(itemId: string, wornOn: string): Promise<void> {
  const { error } = await getSupabase()
    .from('item_wears')
    .delete()
    .eq('item_id', itemId)
    .eq('worn_on', wornOn)
  if (error) throw error
}
