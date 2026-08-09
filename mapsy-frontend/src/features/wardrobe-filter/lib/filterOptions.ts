import type { Item } from '@/entities/item'

/**
 * The free-text axes' options, read back out of the wardrobe.
 *
 * 색상 and 계절 come from fixed presets, so their chips can be listed ahead of
 * time. 브랜드 · 사이즈 · 핏 · 태그 cannot: sizes are per-category with a free-text
 * fallback and the other three are typed in. Offering every conceivable value
 * would be a wall of chips, and offering none would make four of the PRD's
 * filter axes unreachable — so the options are exactly the values this wardrobe
 * actually contains.
 *
 * A section with no values renders nothing rather than an empty heading, which
 * is why the sheet checks the lengths.
 */
export interface FilterOptions {
  brands: string[]
  sizes: string[]
  fits: string[]
  tags: string[]
}

export function deriveFilterOptions(items: readonly Item[]): FilterOptions {
  const brands = new Set<string>()
  const sizes = new Set<string>()
  const fits = new Set<string>()
  const tags = new Set<string>()

  for (const item of items) {
    if (item.brand) brands.add(item.brand)
    if (item.size) sizes.add(item.size)
    if (item.fit) fits.add(item.fit)
    for (const tag of item.tags) tags.add(tag)
  }

  // Korean-aware, so 니트 sorts next to 니트류 rather than by code point.
  const sorted = (values: Set<string>) => [...values].sort((a, b) => a.localeCompare(b, 'ko'))

  return {
    brands: sorted(brands),
    sizes: sorted(sizes),
    fits: sorted(fits),
    tags: sorted(tags),
  }
}
