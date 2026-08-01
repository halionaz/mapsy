import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { releasePreview, type ProcessedPhoto } from '@/shared/lib/image'
import type { ItemDraft, ItemStatus } from '@/types/item'
import * as api from './api'
import type { WardrobeItem } from './api'

/**
 * Query layer for the wardrobe.
 *
 * The whole collection is fetched once and filtered client-side (PRD §8.4), so
 * there is a single cache entry every screen reads from. Mutations patch that
 * entry directly instead of refetching, which is what keeps a tap on the
 * favourite star instant.
 */

export const WARDROBE_KEY = ['wardrobe'] as const

/**
 * A cached item, possibly one that has not finished uploading.
 *
 * Registration puts the card on the grid before the photos are stored (PRD §8.5)
 * — standing in front of a wardrobe, waiting on an upload before you can add the
 * next garment is the thing that makes people stop logging them.
 */
export interface WardrobeEntry extends WardrobeItem {
  upload?: 'uploading' | 'failed'
}

interface PendingUpload {
  draft: ItemDraft
  photos: ProcessedPhoto[]
  userId: string
}

/**
 * Payloads for optimistic entries that have not landed yet, so a failed upload
 * can be retried from the grid. Module-level because the form that started the
 * upload has already navigated away by the time it fails.
 *
 * Lives only as long as the tab: full offline queueing is explicitly out of
 * scope (PRD §8.5), and persisting Blobs to IndexedDB is that feature, not this
 * one.
 */
const pendingUploads = new Map<string, PendingUpload>()

export function useWardrobe() {
  // Typed as WardrobeEntry rather than the fetch's return type: the cache also
  // holds optimistic entries that mutations put there, and consumers have to see
  // the `upload` field to render them.
  return useQuery<WardrobeEntry[]>({
    queryKey: WARDROBE_KEY,
    queryFn: api.fetchWardrobe,
  })
}

function optimisticEntry(tempId: string, pending: PendingUpload): WardrobeEntry {
  const now = new Date().toISOString()
  const { draft, photos, userId } = pending
  return {
    id: tempId,
    userId,
    title: draft.title.trim(),
    categoryId: draft.categoryId,
    brand: draft.brand ?? null,
    size: draft.size ?? null,
    fit: draft.fit ?? null,
    colors: draft.colors ?? [],
    seasons: draft.seasons ?? [],
    price: draft.price ?? null,
    purchasedAt: draft.purchasedAt ?? null,
    purchasePlace: draft.purchasePlace ?? null,
    memo: draft.memo ?? null,
    tags: draft.tags ?? [],
    status: 'owned',
    isFavorite: draft.isFavorite ?? false,
    createdAt: now,
    updatedAt: now,
    images: [],
    // The locally generated thumbnail stands in until the signed URL exists, so
    // the card is never a grey box.
    coverUrl: photos[0]?.previewUrl ?? null,
    upload: 'uploading',
  }
}

function patchCache(
  queryClient: ReturnType<typeof useQueryClient>,
  update: (entries: WardrobeEntry[]) => WardrobeEntry[],
) {
  queryClient.setQueryData<WardrobeEntry[]>(WARDROBE_KEY, (entries) =>
    update(entries ?? []),
  )
}

export function useCreateItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vars: { tempId: string; pending: PendingUpload }) => {
      const { draft, photos, userId } = vars.pending
      return api.createItem(draft, photos, userId)
    },

    onMutate: ({ tempId, pending }) => {
      pendingUploads.set(tempId, pending)
      patchCache(queryClient, (entries) => [optimisticEntry(tempId, pending), ...entries])
    },

    onSuccess: (created, { tempId }) => {
      const pending = pendingUploads.get(tempId)
      pendingUploads.delete(tempId)
      patchCache(queryClient, (entries) =>
        entries.map((entry) => (entry.id === tempId ? created : entry)),
      )
      // The preview object URLs have been replaced by signed ones; holding the
      // blobs any longer just leaks them.
      pending?.photos.forEach(releasePreview)
    },

    onError: (_error, { tempId }) => {
      // The entry stays on the grid rather than vanishing — the retry affordance
      // has to be attached to something the user can see.
      patchCache(queryClient, (entries) =>
        entries.map((entry) =>
          entry.id === tempId ? { ...entry, upload: 'failed' } : entry,
        ),
      )
    },
  })
}

/** Re-runs a create that failed, reusing the blobs already processed. */
export function useRetryUpload() {
  const create = useCreateItem()
  const queryClient = useQueryClient()

  return {
    retry: (tempId: string) => {
      const pending = pendingUploads.get(tempId)
      if (!pending) return
      // Drop the failed placeholder first; onMutate re-adds a fresh one.
      patchCache(queryClient, (entries) => entries.filter((entry) => entry.id !== tempId))
      create.mutate({ tempId, pending })
    },
  }
}

/** Abandons a failed upload and removes its card. */
export function useDiscardUpload() {
  const queryClient = useQueryClient()

  return (tempId: string) => {
    pendingUploads.get(tempId)?.photos.forEach(releasePreview)
    pendingUploads.delete(tempId)
    patchCache(queryClient, (entries) => entries.filter((entry) => entry.id !== tempId))
  }
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
      const previous = queryClient.getQueryData<WardrobeEntry[]>(WARDROBE_KEY)
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
