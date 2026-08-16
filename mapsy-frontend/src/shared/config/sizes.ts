/**
 * 사이즈 프리셋 — PRD §5.4.
 *
 * 체계가 카테고리마다 다르다. 상의는 M, 바지는 30인치, 신발은 270mm. 하나의 자유 입력
 * 필드로 뭉치면 사이즈 필터가 쓸모없어지므로, 폼은 고른 카테고리의 프리셋을 내주고
 * 예외적인 것(브랜드 고유 표기, 수입 라벨)은 자유 입력으로 받는다.
 *
 * 저장되는 값은 프리셋이든 직접 입력이든 늘 평범한 문자열이라 스키마는 `size` 한 컬럼이다.
 */

import type { CategoryGroupId } from './categories'

const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'FREE']

// 26–38인치. 34 위의 홀수를 솎아내지 않고 전부 적는다 — 드문 쪽이야말로 없으면
// 손으로 쳐야 하는 값이다.
const BOTTOM_SIZES = [
  ...Array.from({ length: 13 }, (_, i) => String(26 + i)),
  'S',
  'M',
  'L',
  'XL',
  'FREE',
]

// 220–300mm, 5mm 간격.
const SHOE_SIZES = Array.from({ length: 17 }, (_, i) => String(220 + i * 5))

const FREE_ONLY = ['FREE']

export const SIZE_PRESETS: Record<CategoryGroupId, string[]> = {
  top: APPAREL_SIZES,
  outer: APPAREL_SIZES,
  onepiece: APPAREL_SIZES,
  bottom: BOTTOM_SIZES,
  shoes: SHOE_SIZES,
  bag: FREE_ONLY,
  accessory: FREE_ONLY,
  etc: FREE_ONLY,
}

export function sizePresetsFor(groupId: CategoryGroupId | undefined): string[] {
  return groupId ? SIZE_PRESETS[groupId] : []
}
