import { categoryLabel, type SubcategoryId } from '@/shared/config/categories'
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
 * `query` and `sort` are not filters in this sense either — the search box holds
 * one, and the other reorders rather than removes. `status` is not reachable
 * from this screen at all: the wardrobe always draws `owned`, and 처분한 옷 is a
 * section of the settings screen with its own predicate.
 */

/**
 * The axes of `WardrobeFilters` that are removable value lists — derived by
 * *addition*: a key qualifies by holding a list of strings, not by failing to
 * appear on a list of exceptions.
 *
 * The direction is the point. Named by subtraction, a new scalar field — say
 * `purchasedAfter: string` — would default to being an axis, satisfy the label
 * `Record` with a one-line function, and then be walked character by character
 * into one chip per letter; removing one of those chips would hand a string to
 * `removeApplied`'s array cast and throw. Named by addition, a new scalar is
 * simply not an axis and a new list is, which is the safer default both ways.
 *
 * A hand-written list was worse than either: `categoryIds` was already missing
 * from it, so a filter set through that axis would have narrowed the grid while
 * counting as zero here, leaving 초기화 disabled over a filtered screen.
 *
 * `groupIds` is the one deliberate exception — a list, but the category rail
 * above the grid already shows and clears it.
 */
type StringListKey<T> = {
  [K in keyof T]-?: T[K] extends readonly string[] ? K : never
}[keyof T]

type ListAxis = Exclude<StringListKey<WardrobeFilters>, 'groupIds'>

export type FilterAxis = ListAxis | 'favoriteOnly'

export interface AppliedFilter {
  /** Stable across renders, and unique — two axes can hold the same string. */
  key: string
  label: string
  axis: FilterAxis
  value?: string
}

/** How each axis renders one of its values. Declaration order is chip order. */
const AXIS_LABELS: Record<ListAxis, (value: string) => string> = {
  categoryIds: (value) => categoryLabel(value as SubcategoryId),
  colors: (value) => colorLabel(value as ColorId),
  seasons: (value) => seasonLabel(value as SeasonId),
  sizes: (value) => value,
  fits: (value) => value,
  brands: (value) => value,
  tags: (value) => `#${value}`,
}

const LIST_AXES = Object.keys(AXIS_LABELS) as ListAxis[]

export function appliedFilters(filters: WardrobeFilters): AppliedFilter[] {
  const applied: AppliedFilter[] = []

  for (const axis of LIST_AXES) {
    for (const value of filters[axis]) {
      applied.push({ key: `${axis}:${value}`, label: AXIS_LABELS[axis](value), axis, value })
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

  // The list axes hold different element types (`ColorId[]`, `SeasonId[]`,
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
