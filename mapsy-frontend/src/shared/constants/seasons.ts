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

export interface Season {
  id: SeasonId
  label: string
}

export const SEASONS: Season[] = [
  { id: 'spring', label: '봄' },
  { id: 'summer', label: '여름' },
  { id: 'fall', label: '가을' },
  { id: 'winter', label: '겨울' },
]

const LABEL_BY_ID = new Map(SEASONS.map((s) => [s.id, s.label]))

export function seasonLabel(id: SeasonId): string {
  return LABEL_BY_ID.get(id) ?? id
}
