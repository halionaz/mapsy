import { useSyncExternalStore } from 'react'

import { parseDay } from '@/shared/lib/calendarDay'

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
 *
 * Surviving a full restart is also what makes the two checks in `isUsable`
 * necessary rather than defensive — see there.
 */

export interface WearDraft {
  /**
   * Whose selection this is.
   *
   * Stored because this outlives a session: sign out, sign in as somebody else,
   * and without it their screen opens holding a stranger's picks — with none of
   * the ticked cards visible, since the wardrobe underneath is a different one.
   * The submit would then fail on the foreign key, which is the database
   * catching a mistake this store should not have made.
   */
  userId: string
  /** Which day is being written. */
  wornOn: string
  itemIds: string[]
}

const STORAGE_KEY = 'mapsy.wear-draft'

/**
 * Whether a stored draft is one the screen asking may act on.
 *
 * Both conditions are checked *here*, on every read, rather than once when the
 * value is restored. That placement is the fix for a real defect: a tab left
 * open across midnight kept a draft whose day the clock had moved past, so
 * pressing submit would have written one day's clothes against another.
 * Restoring is not the only moment a draft can go stale — living is.
 *
 * `today` comes from the caller for the same reason `useToday` exists: a second
 * clock read here could disagree with the one the screen is drawing.
 *
 * One day, because one day is all the app writes. 어제 was reachable for a
 * while and the date control that reached it is gone until there is a real date
 * picker; widening this before then would leave a state nothing on screen can
 * produce.
 */
function isUsable(draft: WearDraft, owner: string | null, today: string): boolean {
  // No separate arm for `owner === null`. A draft always carries a non-empty
  // `userId` — `load` and `openWearDraft` are the only writers and both enforce
  // it — so a signed-out screen fails this comparison like any other mismatch.
  return draft.userId === owner && draft.wornOn === today
}

/**
 * Reads the stored draft, or null if it is not one.
 *
 * Shape only. Whether the day is still one of the two the app writes, and whose
 * draft it is, are `isUsable`'s to answer — this runs at module load, where
 * there is no session to compare against and no reason to have a second opinion
 * about what day it is.
 */
function load(): WearDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    // Validated rather than cast. This is the one input to the app that a
    // previous version of the app wrote, and the shape it wrote is not a
    // promise.
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null

    const { userId, wornOn, itemIds } = parsed as Record<string, unknown>
    if (typeof userId !== 'string' || userId === '') return null
    if (typeof wornOn !== 'string' || parseDay(wornOn) === null) return null
    if (!Array.isArray(itemIds) || !itemIds.every((id) => typeof id === 'string')) return null

    return { userId, wornOn, itemIds }
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

/**
 * The draft this screen may act on, or null.
 *
 * A draft that fails `isUsable` is simply not returned. It is left in storage
 * rather than cleared, because clearing would be a write during a render — and
 * it is inert: nothing else reads the store, and the next `openWearDraft`
 * overwrites it.
 */
export function useWearDraft(owner: string | null, today: string): WearDraft | null {
  const draft = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
  return draft && isUsable(draft, owner, today) ? draft : null
}

/**
 * Starts a selection, seeded with what that day already holds.
 *
 * Replaces rather than merges. Only today is writable right now so there is
 * nothing to carry across, but the moment a date picker exists the ids in hand
 * describe the *previous* day — merging them would submit one day's clothes
 * against another.
 */
export function openWearDraft(userId: string, wornOn: string, itemIds: Iterable<string>): void {
  commit({ userId, wornOn, itemIds: [...itemIds] })
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
