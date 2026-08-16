import type { Item } from '@/entities/item'

/**
 * 자유 입력 축의 선택지를 옷장에서 되읽는다.
 *
 * 색상과 계절은 고정 프리셋이라 칩을 미리 적어둘 수 있다. 브랜드·사이즈·핏·태그는 아니다 —
 * 사이즈는 카테고리별 프리셋에 자유 입력이 붙고 나머지 셋은 직접 친다. 가능한 값을 다
 * 내놓으면 칩의 벽이 되고, 하나도 안 내놓으면 필터 축 넷이 닿을 수 없게 된다.
 *
 * 값이 없는 구획은 빈 제목이 아니라 아무것도 그리지 않는다 — 그래서 시트가 길이를 본다.
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

  // 코드 포인트가 아니라 한국어 순서로 — 니트 옆에 니트류가 오도록.
  const sorted = (values: Set<string>) => [...values].sort((a, b) => a.localeCompare(b, 'ko'))

  return {
    brands: sorted(brands),
    sizes: sorted(sizes),
    fits: sorted(fits),
    tags: sorted(tags),
  }
}
