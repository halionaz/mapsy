import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { isSupabaseConfigured } from '@/shared/api/supabase'
import * as api from '../api/wearApi'
import { wearKeys } from './queryKeys'
import type { WearEntry } from './types'

/**
 * Query layer for the wear log.
 *
 * One cache entry holding every wear, patched in place by the two mutations —
 * the same arrangement `entities/item/model/queries.ts` sets out at length, and
 * that docblock is the full reasoning for the `cancelQueries` before each patch
 * and the conditional invalidate after it. What is different here is only what
 * the patches do.
 */

export function useWears() {
  return useQuery<WearEntry[]>({
    queryKey: wearKeys.list(),
    queryFn: api.fetchWears,
    // Preview mode has no backend to ask; without this the query runs anyway
    // and `getSupabase()` throws.
    enabled: isSupabaseConfigured,
  })
}

/**
 * Takes a deleted garment's wears out of the cache.
 *
 * Called by `useDeleteItem`, which is an import from the item entity into this
 * one and is meant to be: the database cascades these rows away with the item
 * (`item_wears_item_fk ... on delete cascade`), so a cache that keeps them is a
 * cache disagreeing with the schema. Leaving the two caches independent looked
 * like the tidier layering and produced this, measured:
 *
 *   delete a garment recorded yesterday → the wear button still counts it →
 *   opening the day seeds the selection with an id that has no card, so it
 *   cannot be unticked → submit sends it → `item_wears_item_fk` → the whole
 *   function rolls back and the day cannot be recorded at all. `staleTime` is
 *   30 minutes and focus refetch respects it, so nothing clears it in between.
 *
 * The cancel matters for the same reason it does in every mutation here: a wear
 * fetch already in flight holds rows from before the delete, and would put the
 * ghost straight back.
 */
export async function dropItemWears(queryClient: QueryClient, itemId: string): Promise<void> {
  await queryClient.cancelQueries({ queryKey: wearKeys.all })
  queryClient.setQueryData<WearEntry[]>(wearKeys.list(), (entries) =>
    entries ? entries.filter((entry) => entry.itemId !== itemId) : entries,
  )
}

function useWearCache() {
  const queryClient = useQueryClient()

  return {
    queryClient,
    before: () => queryClient.cancelQueries({ queryKey: wearKeys.all }),
    after: () => {
      if (queryClient.getQueryData<WearEntry[]>(wearKeys.list()) === undefined) {
        void queryClient.invalidateQueries({ queryKey: wearKeys.all })
      }
    },
    patch: (update: (entries: WearEntry[]) => WearEntry[]) =>
      queryClient.setQueryData<WearEntry[]>(wearKeys.list(), (entries) =>
        entries ? update(entries) : entries,
      ),
  }
}

/**
 * Submits a day: these garments, that day, and nothing else.
 *
 * Deliberately **not** optimistic. The other four wardrobe mutations are, and
 * for the same reason this one is not: they change one field of one row, so a
 * rollback puts back something the user can still see. This one rewrites a whole
 * day, and the state it would have to restore is the state the screen has just
 * left. A failure here has to leave the user still holding their selection, so
 * the sheet closes on success and only on success.
 */
export function useSetWears() {
  const { patch, before, after } = useWearCache()

  return useMutation({
    mutationFn: ({ wornOn, itemIds }: { wornOn: string; itemIds: string[] }) =>
      api.setWears(wornOn, itemIds),

    onSuccess: async (_data, { wornOn, itemIds }) => {
      await before()
      // The day is replaced wholesale, which is what the function did. Order is
      // not preserved because nothing reads it — `summarizeWears` takes a max
      // and `itemIdsWornOn` builds a set, both order-independent, and the fetch
      // sorts only so a truncated response would be the recent end.
      patch((entries) => [
        ...entries.filter((entry) => entry.wornOn !== wornOn),
        ...itemIds.map((itemId) => ({ itemId, wornOn })),
      ])
      after()
    },
  })
}

/**
 * One garment on one day, from the detail screen.
 *
 * Optimistic, unlike the submit above: this is a single fact toggling, the star
 * next to it behaves the same way, and there is a visible control to put back if
 * the write is refused.
 */
export function useToggleWear() {
  const { queryClient, patch, before, after } = useWearCache()

  return useMutation({
    mutationFn: ({
      itemId,
      userId,
      wornOn,
      worn,
    }: {
      itemId: string
      userId: string
      wornOn: string
      worn: boolean
    }) => (worn ? api.addWear(itemId, userId, wornOn) : api.removeWear(itemId, wornOn)),

    onMutate: async ({ itemId, wornOn, worn }) => {
      await before()
      const previous = queryClient.getQueryData<WearEntry[]>(wearKeys.list())
      patch((entries) => {
        const without = entries.filter(
          (entry) => !(entry.itemId === itemId && entry.wornOn === wornOn),
        )
        return worn ? [...without, { itemId, wornOn }] : without
      })
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(wearKeys.list(), context.previous)
      }
    },

    onSettled: after,
  })
}
