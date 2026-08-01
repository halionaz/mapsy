import { useSyncExternalStore } from 'react'

import { releasePreview, type ProcessedPhoto } from '@/shared/lib/image'
import type { ItemDraft } from '@/types/item'

/**
 * Registrations that have not landed on the server yet.
 *
 * Kept outside the query cache on purpose. They used to live in it as optimistic
 * entries, but `useWardrobe`'s response replaces that array wholesale — so any
 * refetch (a remount after `staleTime`, which happens just by visiting the
 * detail screen and coming back) erased them mid-flight. The card vanished, and
 * with it the only route to the retry button, while the blobs stayed in memory
 * unreachable.
 *
 * Holding them here means a refetch is simply irrelevant to them.
 *
 * Lives only as long as the tab: full offline queueing is explicitly out of
 * scope (PRD §8.5), and persisting Blobs to IndexedDB is that feature, not this.
 */

export interface PendingUpload {
  tempId: string
  draft: ItemDraft
  photos: ProcessedPhoto[]
  userId: string
  state: 'uploading' | 'failed'
}

let snapshot: PendingUpload[] = []
const listeners = new Set<() => void>()

function commit(next: PendingUpload[]) {
  snapshot = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePendingUploads(): PendingUpload[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
}

export function getPending(tempId: string): PendingUpload | undefined {
  return snapshot.find((entry) => entry.tempId === tempId)
}

/** Newest first, matching the wardrobe's default order. */
export function addPending(entry: PendingUpload): void {
  commit([entry, ...snapshot.filter((e) => e.tempId !== entry.tempId)])
}

export function markPendingState(tempId: string, state: PendingUpload['state']): void {
  commit(snapshot.map((e) => (e.tempId === tempId ? { ...e, state } : e)))
}

/**
 * Removes an entry and frees its preview object URLs.
 *
 * Always goes through here rather than filtering the array directly, so the
 * blobs cannot be dropped without being revoked.
 */
export function removePending(tempId: string): void {
  const entry = getPending(tempId)
  if (!entry) return
  entry.photos.forEach(releasePreview)
  commit(snapshot.filter((e) => e.tempId !== tempId))
}
