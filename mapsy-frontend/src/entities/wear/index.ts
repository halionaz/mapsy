/**
 * Public API of the wear entity — 착용 기록.
 *
 * A garment worn on a day. Separate from `entities/item` rather than a few more
 * columns on it, because the two are written at completely different rates: an
 * item is registered once and edited rarely, a wear is recorded every morning.
 * Keeping them apart is what lets a wear toggle leave the item cache — and every
 * signed cover URL in it — untouched.
 */

export type { WearEntry, WearSummary, Worn } from './model/types'

export { useSetWears, useToggleWear, useWears } from './model/queries'

export { attachWears, itemIdsWornOn, summarizeWears } from './lib/wearStats'
