import { describe, expect, it } from 'vitest'

import { DB_CONSTRAINT_DEFS } from '@/shared/config/dbConstraints.generated'
import { MAX_COLORS_PER_ITEM } from '@/shared/config/colors'
import { MAX_SEASONS_PER_ITEM } from '@/shared/config/seasons'
import { MAX_PHOTOS } from '../ui/PhotoPicker'
import { LIMITS } from './limits'

/**
 * The form's copies of database ceilings, checked against the schema.
 *
 * The generated inventory used to carry names only, and a name is not what
 * drifts: `items_price_max` kept its name while the number beside it was wrong
 * by a factor of ten, and what found it was a user whose five photos had already
 * uploaded. So the definitions are generated too, and every ceiling in them has
 * to be accounted for here — either mirrored, or written down as deliberately
 * unmirrored with the reason.
 *
 * The second direction is the one that matters. Anyone can add a ceiling to a
 * migration; nobody has to remember this file exists, because a new one with no
 * entry fails the last test below.
 */

/** The N in a `… <= N` CHECK, or null where a constraint sets no ceiling. */
function ceilingOf(definition: string): number | null {
  const match = /<=\s*(\d+)/.exec(definition)
  return match ? Number(match[1]) : null
}

const CEILINGS = Object.entries(DB_CONSTRAINT_DEFS)
  .map(([name, definition]) => [name, ceilingOf(definition)] as const)
  .filter((entry): entry is readonly [string, number] => entry[1] !== null)

/** Constraint name → the client-side number that has to equal its ceiling. */
const MIRRORED: Record<string, number> = {
  items_title_length: LIMITS.title,
  items_brand_length: LIMITS.brand,
  items_size_length: LIMITS.size,
  items_purchase_place_length: LIMITS.purchasePlace,
  items_memo_length: LIMITS.memo,
  items_tags_element_length: LIMITS.tagLength,
  items_tags_limit: LIMITS.tagCount,
  items_price_max: LIMITS.price,
  items_colors_limit: MAX_COLORS_PER_ITEM,
  items_seasons_limit: MAX_SEASONS_PER_ITEM,
  // The ceiling is on `sort_order`, which starts at 0 — so the last usable index
  // is one less than the number of photos the picker will accept.
  item_images_sort_order_range: MAX_PHOTOS - 1,
}

/** Ceilings with no client-side copy, and why none is needed. */
const UNMIRRORED: Record<string, string> = {
  items_fit_length:
    '핏은 프리셋 칩으로만 고르고 자유 입력이 없어서, 사용자가 길이를 넘길 방법이 없다. ' +
    '사이즈는 직접 입력이 있어 LIMITS.size로 막는다.',
}

describe('폼이 미러링하는 DB 상한', () => {
  it('스키마에서 상한을 뽑아낸다', () => {
    // 정규식이 조용히 아무것도 못 잡으면 아래 단언들이 전부 공회전한다.
    expect(CEILINGS.length).toBeGreaterThan(0)
    expect(ceilingOf('CHECK (((sort_order >= 0) AND (sort_order <= 4)))')).toBe(4)
    expect(ceilingOf("CHECK ((status = ANY (ARRAY['owned'::text])))")).toBeNull()
  })

  it.each(Object.entries(MIRRORED))('%s 의 값이 스키마와 같다', (name, mirrored) => {
    const definition = DB_CONSTRAINT_DEFS[name as keyof typeof DB_CONSTRAINT_DEFS]
    expect(definition, `${name}이 스키마에 없음 — 이름이 바뀌었거나 사라졌다`).toBeDefined()
    expect(ceilingOf(definition)).toBe(mirrored)
  })

  it('미러링하지 않기로 한 제약도 실제로 존재한다', () => {
    const stale = Object.keys(UNMIRRORED).filter((name) => !(name in DB_CONSTRAINT_DEFS))
    expect(stale, '스키마에 없는 제약을 면제하고 있음').toEqual([])
  })

  it('스키마의 모든 상한이 미러링되거나 면제되어 있다', () => {
    const unaccounted = CEILINGS.map(([name]) => name).filter(
      (name) => !(name in MIRRORED) && !(name in UNMIRRORED),
    )
    expect(
      unaccounted,
      '새 상한이 생겼다. 폼에서 미리 막든지, UNMIRRORED에 이유를 적을 것 — ' +
        '막지 않으면 사진을 다 올린 뒤 INSERT에서 죽는다',
    ).toEqual([])
  })
})
