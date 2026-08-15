import { groupIdOf } from '@/shared/config/categories'
import { matchesQuery } from '@/shared/lib/hangul'
import type { Item } from '@/entities/item'
import type { SortId, WardrobeFilters } from '../model/filters'

/**
 * Client-side filtering and sorting — PRD §6.1, §8.4.
 *
 * The whole wardrobe is held in memory, so this runs on every keystroke and chip
 * tap with no network round trip. Pure on purpose: this is the logic that
 * decides what the user sees, and it should be testable without a database.
 *
 * Values within one axis are OR'd and the axes are AND'd, so selecting 블랙 and
 * 네이비 widens the result while adding 여름 narrows it. That asymmetry is what
 * people expect from faceted filters, and getting it backwards makes multi-select
 * feel broken.
 */

function hasAny<T>(itemValues: readonly T[], selected: readonly T[]): boolean {
  if (selected.length === 0) return true
  return itemValues.some((value) => selected.includes(value))
}

function includesOrEmpty(value: string | null, selected: readonly string[]): boolean {
  if (selected.length === 0) return true
  return value !== null && selected.includes(value)
}

/** Searches the fields a person would expect to search: name, brand, memo, tags. */
function matchesSearch(item: Item, query: string): boolean {
  if (!query.trim()) return true
  const haystacks = [item.title, item.brand, item.memo, ...item.tags]
  return haystacks.some((text) => text != null && matchesQuery(text, query))
}

function compare(a: Item, b: Item, sort: SortId): number {
  switch (sort) {
    case 'recent':
      return b.createdAt.localeCompare(a.createdAt)
    case 'title':
      return a.title.localeCompare(b.title, 'ko')
    case 'price_desc':
    case 'price_asc': {
      // Items with no price sink to the bottom either way — a missing price is
      // unknown, not zero, and burying it keeps the top of the list meaningful.
      if (a.price == null && b.price == null) return b.createdAt.localeCompare(a.createdAt)
      if (a.price == null) return 1
      if (b.price == null) return -1
      return sort === 'price_desc' ? b.price - a.price : a.price - b.price
    }
  }
}

export function applyFilters<T extends Item>(
  items: readonly T[],
  filters: WardrobeFilters,
): T[] {
  const matched = items.filter((item) => {
    if (item.status !== filters.status) return false
    if (filters.favoriteOnly && !item.isFavorite) return false

    // No arm for "this id has no group": `Item.categoryId` is a `SubcategoryId`,
    // which `groupIdOf` answers totally. The guard that used to be here read as
    // caution but could only have meant "hide the garment", and it covered a
    // case `mapRow` already folds into 기타 at the boundary.
    if (filters.groupIds.length > 0 && !filters.groupIds.includes(groupIdOf(item.categoryId))) {
      return false
    }

    if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(item.categoryId)) {
      return false
    }

    if (!hasAny(item.colors, filters.colors)) return false
    if (!hasAny(item.seasons, filters.seasons)) return false
    if (!hasAny(item.tags, filters.tags)) return false

    if (!includesOrEmpty(item.size, filters.sizes)) return false
    if (!includesOrEmpty(item.fit, filters.fits)) return false
    if (!includesOrEmpty(item.brand, filters.brands)) return false

    return matchesSearch(item, filters.query)
  })

  // Copy before sorting: the input is the query cache's array and mutating it
  // would reorder every other reader.
  return [...matched].sort((a, b) => compare(a, b, filters.sort))
}
