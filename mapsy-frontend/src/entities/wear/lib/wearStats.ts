import type { WearEntry, WearSummary, Worn } from '../model/types'

/**
 * Turning the wear log into what the screens actually ask it.
 *
 * All of it is derived on the client from one array, which is the same bet the
 * wardrobe already makes (PRD §8.4). The alternative — a `wear_count` column
 * and a trigger keeping it true — buys a cheaper read and costs the thing that
 * matters here: a count and a max are two of the questions this data answers,
 * and 어제 was worn, and which garments share a day, and a calendar later. Those
 * come free from the rows and would each need their own column.
 */

const EMPTY: WearSummary = { wearCount: 0, lastWornOn: null }

/**
 * Per-garment totals, in one pass.
 *
 * `lastWornOn` is a string comparison, which is exact rather than lucky:
 * `YYYY-MM-DD` is fixed-width and zero-padded, so lexical order *is* calendar
 * order. No Date is constructed, and none should be — parsing thousands of rows
 * to compare them is work, and every parse is another place a timezone can get
 * in.
 */
export function summarizeWears(entries: readonly WearEntry[]): Map<string, WearSummary> {
  const summary = new Map<string, WearSummary>()

  for (const entry of entries) {
    const current = summary.get(entry.itemId)
    if (!current) {
      summary.set(entry.itemId, { wearCount: 1, lastWornOn: entry.wornOn })
      continue
    }
    current.wearCount += 1
    // The null arm is unreachable — every entry in this map was created with a
    // day — but writing it out beats comparing against a `''` sentinel that
    // exists only to satisfy the type. A sentinel would still be there if the
    // shape ever gained a genuinely absent case.
    if (current.lastWornOn === null || entry.wornOn > current.lastWornOn) {
      current.lastWornOn = entry.wornOn
    }
  }

  return summary
}

/**
 * Items with their wear history on them.
 *
 * Merged here rather than in the item query so a wear toggle does not touch the
 * wardrobe cache: re-fetching that entry would re-sign every cover URL and
 * reload every thumbnail in the grid, which is the cost the item mutations are
 * already written to avoid.
 *
 * Every item gets a summary, including the ones with no entries — an item whose
 * fields were merely absent would have to be null-checked at each of the three
 * places that read them, and one of those is a comparator.
 */
export function attachWears<T extends { id: string }>(
  items: readonly T[],
  entries: readonly WearEntry[],
): Worn<T>[] {
  const summary = summarizeWears(entries)
  return items.map((item) => ({ ...item, ...(summary.get(item.id) ?? EMPTY) }))
}

/** Which garments were worn on one day — what the selection sheet opens with. */
export function itemIdsWornOn(entries: readonly WearEntry[], day: string): Set<string> {
  const ids = new Set<string>()
  for (const entry of entries) {
    if (entry.wornOn === day) ids.add(entry.itemId)
  }
  return ids
}
