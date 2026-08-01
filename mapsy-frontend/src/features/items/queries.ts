import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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

    onSuccess: (created, { pending }) => {
      // Prepend rather than invalidate: the server order is newest-first and
      // this is the newest, so a round trip would only re-fetch what we hold.
      patchCache(queryClient, (entries) => [created, ...entries])
      removePending(pending.tempId)
    },

    onError: (_error, { pending }) => {
      // The entry stays visible rather than vanishing — the retry affordance has
      // to be attached to something the user can see, and its blobs stay with it.
      markPendingState(pending.tempId, 'failed')
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
    onMutate: ({ id, isFavorite }) => {
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
