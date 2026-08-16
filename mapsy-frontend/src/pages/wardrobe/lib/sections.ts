import {
  CATEGORY_GROUPS,
  groupIdOf,
  type CategoryGroup,
  type CategoryGroupId,
} from '@/shared/config/categories'
import type { Item } from '@/entities/item'

export interface WardrobeSection<T> {
  group: CategoryGroup
  items: T[]
}

/**
 * 홈 화면용으로 옷장을 상의 · 하의 · 아우터 …로 나눈다.
 *
 * 아무것도 없는 그룹은 빈 제목으로 그리지 않고 뺀다.
 *
 * 구획 사이의 순서는 고정된 카테고리 표의 순서다 — 등록할 때마다 섞이는 옷장은 방문할
 * 때마다 다시 읽어야 한다. 구획 *안*은 받은 순서 그대로라 `applyFilters`의 정렬이
 * 살아남고, 안에서만 살아남으므로 홈 화면의 정렬 컨트롤이 묶음도 함께 부른다.
 *
 * 여기 들어오는 것은 *걸러진* 목록이다. 카테고리 레일은 가진 것 전부에서 지어져 검색
 * 중에도 칩이 제자리에 있다.
 */
export function groupSections<T extends Item>(items: readonly T[]): WardrobeSection<T>[] {
  const buckets = new Map<CategoryGroupId, T[]>()

  for (const item of items) {
    const groupId = groupIdOf(item.categoryId)
    const bucket = buckets.get(groupId)
    if (bucket) bucket.push(item)
    else buckets.set(groupId, [item])
  }

  // 삽입 순서가 아니라 표 순서로 걷고, `flatMap`이라 빈 그룹이 뒤에서 다시 찾을 필요
  // 없이 빠진다.
  return CATEGORY_GROUPS.flatMap((group) => {
    const bucket = buckets.get(group.id)
    return bucket ? [{ group, items: bucket }] : []
  })
}
