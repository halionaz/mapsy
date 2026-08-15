import {
  CATEGORY_GROUPS,
  groupIdOf,
  type CategoryGroup,
  type CategoryGroupId,
} from '@/shared/config/categories'
import type { Item } from '@/entities/item'

interface WardrobeSection<T> {
  group: CategoryGroup
  items: T[]
}

/**
 * The wardrobe split into 상의 · 하의 · 아우터 …, for the home screen.
 *
 * Groups holding nothing are left out rather than drawn as an empty heading —
 * the same rule the filter sheet already applies to its brand and size chips.
 *
 * Order between sections is the category table's, which is fixed: a wardrobe
 * whose sections reshuffled as garments were registered would have to be re-read
 * every visit. Order *inside* a section is the order it was handed, so whatever
 * `applyFilters` sorted by survives the split — and only inside, which is why
 * the home screen's sort control names the grouping too.
 *
 * This is fed the *filtered* list. The category rail is not: it is built from
 * everything owned, so the chips stay put while a search runs. The two lists
 * differ on purpose, and a search that matches only 부츠 leaves 아우터 on the
 * rail and off the screen.
 */
export function groupSections<T extends Item>(items: readonly T[]): WardrobeSection<T>[] {
  const buckets = new Map<CategoryGroupId, T[]>()

  for (const item of items) {
    const groupId = groupIdOf(item.categoryId)
    const bucket = buckets.get(groupId)
    if (bucket) bucket.push(item)
    else buckets.set(groupId, [item])
  }

  // Walked in table order rather than insertion order, and `flatMap` so the
  // empty groups drop out without a lookup that has to be repeated afterwards.
  return CATEGORY_GROUPS.flatMap((group) => {
    const bucket = buckets.get(group.id)
    return bucket ? [{ group, items: bucket }] : []
  })
}
