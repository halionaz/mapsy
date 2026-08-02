/**
 * Seasons — PRD §5.6.
 *
 * Not in the original brief, but it is the axis a wardrobe gets filtered by most
 * often, and it is the precondition for the v1 "what am I missing" grid
 * (category × season). Multi-select, and empty is allowed — plenty of garments
 * are genuinely year-round.
 */

export const SEASON_IDS = ['spring', 'summer', 'fall', 'winter'] as const

export type SeasonId = (typeof SEASON_IDS)[number]

/**
 * Mirrors `items_seasons_limit`.
 *
 * Equal to `SEASON_IDS.length` today, which is exactly why it is written out
 * rather than derived: the form only ever offered as many chips as the database
 * allows *by coincidence*, and adding a fifth season would have let someone pick
 * five, upload five photos, and be rejected at INSERT — the dead end this form's
 * limits exist to keep people out of.
 */
export const MAX_SEASONS_PER_ITEM = 4

/** Keyed by SeasonId so a new season can't ship without its label. */
const SEASON_LABELS: Record<SeasonId, string> = {
  spring: '봄',
  summer: '여름',
  fall: '가을',
  winter: '겨울',
}

export interface Season {
  id: SeasonId
  label: string
}

export const SEASONS: Season[] = SEASON_IDS.map((id) => ({
  id,
  label: SEASON_LABELS[id],
}))

export function seasonLabel(id: SeasonId): string {
  return SEASON_LABELS[id]
}
