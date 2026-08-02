import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api/queryKeys'
import { isSupabaseConfigured } from '@/shared/api/supabase'
import { errorMessage } from '@/shared/lib/errorMessage'
import * as api from '../api/itemApi'
import {
  addPending,
  getPending,
  markPendingState,
  removePending,
  type PendingUpload,
} from './pendingUploads'
import type { ItemDraft, ItemStatus, WardrobeItem } from './types'

/**
 * Query layer for the wardrobe.
 *
 * The whole collection is fetched once and filtered client-side (PRD §8.4), so
 * there is a single cache entry every screen reads from. Mutations patch that
 * entry directly and only refetch when there was nothing to patch, which is what
 * keeps a tap on the favourite star instant — a refetch would re-sign every
 * cover URL and reload the entire grid.
 *
 * In-flight registrations deliberately do *not* live in this cache — see
 * `pendingUploads.ts` for why.
 *
 * Keys come from `shared/api/queryKeys` rather than a const in this file: the
 * mutations below address the same entry from five other places, and a key that
 * drifts turns `setQueryData` into a silent write nobody reads.
 */

export function useWardrobe() {
  return useQuery<WardrobeItem[]>({
    queryKey: queryKeys.wardrobe.list(),
    queryFn: api.fetchWardrobe,
    // Preview mode has no backend to ask. Without this the query runs anyway,
    // `getSupabase()` throws, and the home screen shows a retry-backed error
    // card — contradicting the documented promise that the UI is browsable
    // before a Supabase project exists.
    enabled: isSupabaseConfigured,
  })
}

/**
 * Patches the cached collection in place.
 *
 * Returning the input untouched when there is no cache entry is deliberate:
 * react-query discards a write whose updater returns undefined, and inventing an
 * array here would publish a "wardrobe" containing only the row we just touched.
 * Callers that must not lose their write invalidate instead — see below.
 */
function patchCache(
  queryClient: ReturnType<typeof useQueryClient>,
  update: (entries: WardrobeItem[]) => WardrobeItem[],
) {
  queryClient.setQueryData<WardrobeItem[]>(queryKeys.wardrobe.list(), (entries) =>
    entries ? update(entries) : entries,
  )
}

/**
 * What every mutation needs around a cache patch.
 *
 * `before` — a fetch already in flight holds a snapshot from before the
 * mutation, and its response overwrites whatever was patched while it was
 * travelling. Cancelling closes that race, and it is cheap, so all five
 * mutations do it. `refetchOnWindowFocus` makes the race reachable in ordinary
 * use: the refetch fires the moment the app is foregrounded, which is exactly
 * when someone resumes what they were doing.
 *
 * `after` — only when there is no cache entry to have patched. In practice that
 * is `useCreateItem` alone: the other four are reached from screens that already
 * read the collection, so their cache is warm by construction. An unconditional
 * invalidate looked tidy and was expensive: `useWardrobe` is observed by three
 * screens so it is always active, meaning every star tap refetched the whole
 * collection *and* re-signed every cover URL, changing every `<img src>` and
 * reloading every thumbnail in the grid. Where the mutation patches the server's
 * own response, a refetch can only return what the cache already holds.
 */
function useCachePatch() {
  const queryClient = useQueryClient()

  return {
    queryClient,
    // `all` rather than `list()`: cancel and invalidate match by prefix, so a
    // second wardrobe query added later is covered without touching this.
    before: () => queryClient.cancelQueries({ queryKey: queryKeys.wardrobe.all }),
    after: () => {
      const cached = queryClient.getQueryData<WardrobeItem[]>(queryKeys.wardrobe.list())
      if (cached === undefined) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.wardrobe.all })
      }
    },
  }
}

export function useCreateItem() {
  const { queryClient, before, after } = useCachePatch()

  return useMutation({
    mutationFn: ({ pending }: { pending: PendingUpload }) =>
      api.createItem(pending.draft, pending.photos, pending.userId),

    onMutate: ({ pending }) => {
      addPending({ ...pending, state: 'uploading' })
    },

    onSuccess: async (created, { pending }) => {
      // Two ways a plain prepend loses the item: an in-flight refetch overwrites
      // it when it lands, or the cache entry was evicted while the form was open
      // and the write is dropped entirely. Either way `removePending` then takes
      // the card away, revoking the preview URLs with it, and the registration
      // vanishes exactly as it did before the pending store existed.
      //
      // `before` closes the first; `after` refetches for real in the second.
      await before()
      patchCache(queryClient, (entries) => [created, ...entries])
      removePending(pending.tempId)
      after()
    },

    onError: (error, { pending }) => {
      // The entry stays visible rather than vanishing — the retry affordance has
      // to be attached to something the user can see, and its blobs stay with it.
      // The reason travels with it: a constraint violation ("메모가 너무 김")
      // fails identically on every retry, and without the message the user has
      // no way to know that retrying is pointless.
      markPendingState(pending.tempId, 'failed', errorMessage(error))
    },
  })
}

/** Re-runs a create that failed, reusing the blobs already processed. */
export function useRetryUpload() {
  const create = useCreateItem()

  return (tempId: string) => {
    const pending = getPending(tempId)
    if (!pending || pending.state !== 'failed') return
    create.mutate({ pending })
  }
}

/** Abandons a failed upload, freeing its preview URLs. */
export function useDiscardUpload() {
  return (tempId: string) => removePending(tempId)
}

export function useUpdateItem() {
  const { queryClient, before, after } = useCachePatch()

  return useMutation({
    mutationFn: (vars: { id: string; draft: ItemDraft }) =>
      api.updateItem(vars.id, vars.draft),
    onSuccess: async (updated) => {
      await before()
      patchCache(queryClient, (entries) =>
        entries.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)),
      )
      after()
    },
  })
}

export function useSetFavorite() {
  const { queryClient, before, after } = useCachePatch()

  return useMutation({
    mutationFn: (vars: { id: string; isFavorite: boolean }) =>
      api.setFavorite(vars.id, vars.isFavorite),
    onMutate: async ({ id, isFavorite }) => {
      await before()
      const previous = queryClient.getQueryData<WardrobeItem[]>(queryKeys.wardrobe.list())
      patchCache(queryClient, (entries) =>
        entries.map((entry) => (entry.id === id ? { ...entry, isFavorite } : entry)),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.wardrobe.list(), context.previous)
      }
    },
    // Only does anything if the cache was empty — which the star cannot normally
    // reach, since pressing it requires the detail screen to have found the item
    // in that cache. Kept for the path where it somehow is: a rejected write is
    // already undone by onError above, so this is not the recipe's usual
    // "re-sync with the server" step.
    onSettled: after,
  })
}

export function useSetStatus() {
  const { queryClient, before, after } = useCachePatch()

  return useMutation({
    mutationFn: (vars: { id: string; status: ItemStatus }) =>
      api.setStatus(vars.id, vars.status),
    onSuccess: async (_data, { id, status }) => {
      await before()
      patchCache(queryClient, (entries) =>
        entries.map((entry) => (entry.id === id ? { ...entry, status } : entry)),
      )
      after()
    },
  })
}

export function useDeleteItem() {
  const { queryClient, before, after } = useCachePatch()

  return useMutation({
    mutationFn: (vars: { id: string; userId: string }) =>
      api.deleteItem(vars.id, vars.userId),
    // The most visible of the five without this: an in-flight fetch holding a
    // pre-delete snapshot puts the garment back on the grid, with no error and
    // nothing to retry — the row really is gone, so it disappears again at the
    // next refetch.
    onSuccess: async (_data, { id }) => {
      await before()
      patchCache(queryClient, (entries) => entries.filter((entry) => entry.id !== id))
      after()
    },
  })
}
