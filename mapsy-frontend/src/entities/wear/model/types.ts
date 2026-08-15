/**
 * Domain types for the wear log.
 *
 * A wear is a fact about a (garment, day) pair and carries nothing else — no
 * note, no time, no order. That is the whole reason there is no outfit entity:
 * "what was worn together" is the set of entries sharing a `wornOn`, derived
 * rather than stored.
 *
 * The row has `id`, `user_id` and `created_at` too. None of them are here
 * because none are read: the collection is fetched whole and every operation
 * addresses a row by (item, day), which is also its unique key. Not asking for
 * three unused columns is most of what keeps that full fetch small.
 */
export interface WearEntry {
  itemId: string
  /** The wearer's local calendar day, `YYYY-MM-DD`. See `shared/lib/calendarDay`. */
  wornOn: string
}

/** What a garment's wear history amounts to, once summarised. */
export interface WearSummary {
  wearCount: number
  /**
   * The most recent day this was worn, or null if it never was.
   *
   * Null is not "long ago" — it is "no answer", and the wardrobe's 최근 입은순
   * sorts on that distinction rather than substituting a date.
   */
  lastWornOn: string | null
}

/** An item with its wear history attached, which is what the grid sorts and draws. */
export type Worn<T> = T & WearSummary
