import { colorLabel, type ColorId } from '@/shared/config/colors'
import { seasonLabel, type SeasonId } from '@/shared/config/seasons'
import { EMPTY_FILTERS, type WardrobeFilters } from '../model/filters'

/**
 * What the filter sheet has been asked for, as a list the header can draw and
 * remove one at a time.
 *
 * `groupIds` is deliberately absent: the category rail above the grid already
 * shows that choice as a selected chip, and repeating it in the summary row
 * would give one filter two different places to be turned off.
 *
 * `query`, `status` and `sort` are not filters in this sense either — the search
 * box holds one, the wardrobe/처분함 switch holds the next, and the third
 * reorders rather than removes.
 */

/** The axes the sheet owns, i.e. everything the summary row can clear. */
const LIST_AXES = ['colors', 'seasons', 'sizes', 'fits', 'brands', 'tags'] as const

type ListAxis = (typeof LIST_AXES)[number]

export type FilterAxis = ListAxis | 'favoriteOnly'

export interface AppliedFilter {
  /** Stable across renders, and unique — two axes can hold the same string. */
  key: string
  label: string
  axis: FilterAxis
  value?: string
}

function labelFor(axis: ListAxis, value: string): string {
  if (axis === 'colors') return colorLabel(value as ColorId)
  if (axis === 'seasons') return seasonLabel(value as SeasonId)
  if (axis === 'tags') return `#${value}`
  return value
}

export function appliedFilters(filters: WardrobeFilters): AppliedFilter[] {
  const applied: AppliedFilter[] = []

  for (const axis of LIST_AXES) {
    for (const value of filters[axis]) {
      applied.push({ key: `${axis}:${value}`, label: labelFor(axis, value), axis, value })
    }
  }

  if (filters.favoriteOnly) {
    applied.push({ key: 'favoriteOnly', label: '즐겨찾기', axis: 'favoriteOnly' })
  }

  return applied
}

/** How many axes-values are on, for the badge on the filter button. */
export function activeFilterCount(filters: WardrobeFilters): number {
  return appliedFilters(filters).length
}

export function removeApplied(
  filters: WardrobeFilters,
  applied: AppliedFilter,
): WardrobeFilters {
  if (applied.axis === 'favoriteOnly') return { ...filters, favoriteOnly: false }

  // The six list axes hold different element types (`ColorId[]`, `SeasonId[]`,
  // `string[]`), so there is no signature under which one `filter` call covers
  // all of them. Widening to `string[]` here is the whole cast: the values being
  // removed came out of these same arrays, so nothing can be narrowed away that
  // was not already in them.
  const remaining = (filters[applied.axis] as readonly string[]).filter(
    (value) => value !== applied.value,
  )
  return { ...filters, [applied.axis]: remaining }
}

/**
 * Clears every axis the sheet owns and leaves the rest alone.
 *
 * Spread from `EMPTY_FILTERS` rather than assigning empty arrays one by one, so
 * a new axis added to the type is cleared here without anyone remembering to —
 * and the four fields that must survive are named once, where the reason they
 * survive can be read.
 */
export function clearFilters(filters: WardrobeFilters): WardrobeFilters {
  return {
    ...EMPTY_FILTERS,
    query: filters.query,
    groupIds: filters.groupIds,
    status: filters.status,
    sort: filters.sort,
  }
}
