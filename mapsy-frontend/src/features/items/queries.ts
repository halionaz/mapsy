import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { errorMessage } from '@/shared/lib/errorMessage'
import { isSupabaseConfigured } from '@/shared/lib/supabase'
import type { ItemDraft, ItemStatus } from '@/types/item'
import * as api from './api'
import type { WardrobeItem } from './api'
import {
  addPending,
  getPending,
  markPendingState,
  removePending,
  type PendingUpload,
} from './pendingUploads'

/**
 * Query layer for the wardrobe.
 *
 * The whole collection is fetched once and filtered client-side (PRD §8.4), so
 * there is a single cache entry every screen reads from. Mutations patch that
 * entry directly instead of refetching, which is what keeps a tap on the
 * favourite star instant.
 *
 * In-flight registrations deliberately do *not* live in this cache — see
 * `pendingUploads.ts` for why.
 */

export const WARDROBE_KEY = ['wardrobe'] as const

export function useWardrobe() {
  return useQuery<WardrobeItem[]>({
    queryKey: WARDROBE_KEY,
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
  queryClient.setQueryData<WardrobeItem[]>(WARDROBE_KEY, (entries) =>
    entries ? update(entries) : entries,
  )
}

export function useCreateItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ pending }: { pending: PendingUpload }) =>
      api.createItem(pending.draft, pending.photos, pending.userId),

    onMutate: ({ pending }) => {
      addPending({ ...pending, state: 'uploading' })
    },

    onSuccess: async (created, { pending }) => {
      // A plain prepend is not enough to guarantee the item stays visible.
      // Two ways it disappears: the cache entry may have been garbage collected
      // while the form was open (gcTime is 5 minutes and taking photos takes
      // longer), in which case the write is dropped; or a refetch may already be
      // in flight — now likelier, since this PR turned on refetchOnWindowFocus —
      // and its response overwrites the prepend when it lands.
      //
      // Either way `removePending` then takes the card away, revoking the
      // preview URLs with it, and the registration vanishes exactly as it did
      // before the pending store existed.
      //
      // Cancelling first stops the in-flight response from winning; invalidating
      // afterwards covers the cold-cache case by refetching for real.
      await queryClient.cancelQueries({ queryKey: WARDROBE_KEY })
      patchCache(queryClient, (entries) => [created, ...entries])
      removePending(pending.tempId)
      void queryClient.invalidateQueries({ queryKey: WARDROBE_KEY })
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
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vars: { id: string; draft: ItemDraft }) =>
      api.updateItem(vars.id, vars.draft),
    onSuccess: (updated) => {
      patchCache(queryClient, (entries) =>
        entries.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)),
      )
    },
  })
}

export function useSetFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vars: { id: string; isFavorite: boolean }) =>
      api.setFavorite(vars.id, vars.isFavorite),
    onMutate: async ({ id, isFavorite }) => {
      // An in-flight fetch would land after this patch and undo it — the first
      // line of react-query's own optimistic-update recipe, and reachable now
      // that focus refetching is on.
      await queryClient.cancelQueries({ queryKey: WARDROBE_KEY })
      const previous = queryClient.getQueryData<WardrobeItem[]>(WARDROBE_KEY)
      patchCache(queryClient, (entries) =>
        entries.map((entry) => (entry.id === id ? { ...entry, isFavorite } : entry)),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(WARDROBE_KEY, context.previous)
    },
  })
}

export function useSetStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vars: { id: string; status: ItemStatus }) =>
      api.setStatus(vars.id, vars.status),
    onSuccess: (_data, { id, status }) => {
      patchCache(queryClient, (entries) =>
        entries.map((entry) => (entry.id === id ? { ...entry, status } : entry)),
      )
    },
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vars: { id: string; userId: string }) =>
      api.deleteItem(vars.id, vars.userId),
    onSuccess: (_data, { id }) => {
      patchCache(queryClient, (entries) => entries.filter((entry) => entry.id !== id))
    },
  })
}
