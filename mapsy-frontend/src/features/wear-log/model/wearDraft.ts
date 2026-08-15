import { useSyncExternalStore } from 'react'

import { todayLocal, yesterdayLocal } from '@/shared/lib/calendarDay'

/**
 * The garments picked for a day, before they are submitted.
 *
 * This value *is* selection mode: null means the wardrobe is browsing, anything
 * else means it is choosing. One state instead of a boolean beside a list, so
 * "selecting but no day" and "a day but not selecting" are not representable.
 *
 * Kept outside the query cache for the same reason `pendingUploads` is: this is
 * work in progress, and `useWears`'s response replaces its array wholesale — a
 * refetch on window focus would wipe a half-made selection mid-scroll.
 *
 * Unlike `pendingUploads` it *is* persisted, and the difference is what it
 * holds. That store carries Blobs, which is why writing it down would have meant
 * building offline upload queueing (PRD §8.5). This is a date and a few ids, and
 * the thing it protects against is ordinary: picking three garments, being
 * interrupted, and coming back to an empty grid.
 */

export interface WearDraft {
  /** Which day is being written. Always one of the two the app offers. */
  wornOn: string
  itemIds: string[]
}

const STORAGE_KEY = 'mapsy.wear-draft'

/**
 * The two days a draft may be for.
 *
 * The rule lives here rather than being passed in by the screen, because this is
 * where a stored draft is read back and the check has to happen before anything
 * can render. A draft from last week would otherwise restore into a mode bar
 * with no matching tab, and its submit would rewrite a day nothing on screen
 * names.
 */
function isEditableDay(day: unknown): day is string {
  return typeof day === 'string' && (day === todayLocal() || day === yesterdayLocal())
}

function load(): WearDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    // Everything below is validated rather than cast. This is the one input to
    // the app that a previous version of the app wrote, and the shape it wrote
    // is not a promise — a draft carrying a stale day would submit against it.
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null

    const { wornOn, itemIds } = parsed as Record<string, unknown>
    if (!isEditableDay(wornOn)) return null
    if (!Array.isArray(itemIds) || !itemIds.every((id) => typeof id === 'string')) return null

    return { wornOn, itemIds }
  } catch {
    // Bad JSON, or Safari in private mode, where reading localStorage throws.
    // Neither is worth a screen — the draft was a convenience.
    return null
  }
}

let snapshot: WearDraft | null = load()
const listeners = new Set<() => void>()

function commit(next: WearDraft | null) {
  snapshot = next
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // The draft still lives for this tab; only surviving a reload is lost.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useWearDraft(): WearDraft | null {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
}

/**
 * Starts — or re-points — a selection, seeded with what that day already holds.
 *
 * Also how the 오늘/어제 switch works, which is why it replaces rather than
 * merges: the ids are what *that* day records, so carrying yesterday's unsaved
 * picks across would submit today's clothes against yesterday.
 */
export function openWearDraft(wornOn: string, itemIds: Iterable<string>): void {
  commit({ wornOn, itemIds: [...itemIds] })
}

export function toggleWearDraftItem(itemId: string): void {
  if (!snapshot) return
  const { itemIds } = snapshot
  commit({
    ...snapshot,
    itemIds: itemIds.includes(itemId)
      ? itemIds.filter((id) => id !== itemId)
      : [...itemIds, itemId],
  })
}

export function closeWearDraft(): void {
  commit(null)
}
