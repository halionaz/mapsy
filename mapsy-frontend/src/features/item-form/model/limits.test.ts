import { describe, expect, it } from 'vitest'

import { DB_CONSTRAINTS, DB_CONSTRAINT_DEFS } from '@/shared/config/dbConstraints.generated'
import { CATEGORY_GROUP_IDS } from '@/shared/config/categories'
import { COLOR_IDS, MAX_COLORS_PER_ITEM } from '@/shared/config/colors'
import { MAX_SEASONS_PER_ITEM, SEASON_IDS } from '@/shared/config/seasons'
import { LIMITS, MAX_PHOTOS } from './limits'

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

/**
 * Does this constraint compare against a number at all?
 *
 * Deliberately looser than `ceilingOf`, and that gap is the point. `ceilingOf`
 * only understands `<= N`, so a bound written `length(x) < 101`, or with the
 * operands the other way round, or as `BETWEEN`, would produce no ceiling — and
 * a constraint with no ceiling used to fall out of the accounting entirely and
 * pass in silence, which is the same failure mode the whole file is here to
 * remove. This is what decides *whether an entry is required*; `ceilingOf` only
 * decides what the entry has to equal.
 */
function comparesToNumber(definition: string): boolean {
  return /(<=|>=|<|>)\s*\d+|\d+\s*(<=|>=|<|>)|\bBETWEEN\b/i.test(definition)
}

const BOUNDED = Object.entries(DB_CONSTRAINT_DEFS).filter(([, definition]) =>
  comparesToNumber(definition),
)

/**
 * The values a `<@ ARRAY[…]` or `= ANY (ARRAY[…])` CHECK admits, sorted.
 *
 * The other half of the same problem. A ceiling drifts by a number and a
 * vocabulary drifts by an element, and the second is *easier* to do by accident:
 * adding a colour to `shared/config/colors.ts` puts a chip on the form with
 * nothing in that file to say the database has to agree. The garment then
 * uploads all five photos and dies on `items_colors_valid`.
 *
 * Scoped to the inside of the brackets on purpose. `items_category_group_valid`
 * also contains `split_part(category_id, '.'::text, 1)`, and a pattern that read
 * every quoted literal in the definition would pull that separator in as a ninth
 * category group.
 */
function setOf(definition: string): string[] | null {
  const array = /ARRAY\[([^\]]*)\]/.exec(definition)
  if (!array) return null
  return [...array[1].matchAll(/'([^']*)'::text/g)].map((match) => match[1]).sort()
}

const SETS = Object.entries(DB_CONSTRAINT_DEFS).filter(([, definition]) => setOf(definition))

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

/** 숫자 비교를 하지만 클라이언트에 복사본이 없는 것들 — 없어도 되는 이유와 함께. */
const UNMIRRORED: Record<string, string> = {
  items_fit_length:
    '핏은 프리셋 칩으로만 고르고 자유 입력이 없어서, 사용자가 길이를 넘길 방법이 없다. ' +
    '사이즈는 직접 입력이 있어 LIMITS.size로 막는다.',

  // 아래 다섯은 상한이 아니라 "> 0" 존재성·양수 검사다. 폼이 베낄 숫자가 없고,
  // 어긋날 값도 없다 — 그래도 목록에 있는 이유는, 면제가 판단으로 남아야
  // 새 제약이 조용히 통과하지 않기 때문이다.
  items_title_not_blank: '공백뿐인 이름 거부. 폼의 required 검사가 같은 일을 한다',
  items_price_non_negative: '음수 가격 거부. 폼이 숫자가 아닌 문자를 걸러 음수가 만들어지지 않는다',
  item_images_path_not_blank: '스토리지 경로는 클라이언트가 조립하고 사용자가 입력하지 않는다',
  item_images_dimensions_positive: '너비·높이는 processPhoto가 계산한다',
  // 이 제약은 두 절이다. 그룹 목록은 아래 SET_MIRRORED가 세고, 여기서 면제하는
  // 건 숫자 절인 length(split_part(category_id,'.',2)) > 0뿐이다.
  items_category_group_valid: '소분류가 비어있지 않은지 — 카테고리는 칩으로만 고른다',
}

/** 제약 이름 → 같은 집합을 담고 있어야 하는 클라이언트 목록. */
const SET_MIRRORED: Record<string, readonly string[]> = {
  items_colors_valid: COLOR_IDS,
  items_seasons_valid: SEASON_IDS,
  items_category_group_valid: CATEGORY_GROUP_IDS,
}

/** 집합 제약인데 클라이언트에 런타임 목록이 없는 것 — 없어도 되는 이유와 함께. */
const SET_UNMIRRORED: Record<string, string> = {
  items_status_valid:
    'ItemStatus는 런타임 배열이 아니라 유니온 타입이라 컴파일 타임에 막힌다. ' +
    '상태를 늘리려면 타입을 고쳐야 하고, 그러면 mapRow의 변환도 같이 걸린다 — ' +
    'colors·seasons처럼 목록에 한 줄 더하고 끝나는 모양이 아니다.',
}

describe('폼이 미러링하는 DB 상한', () => {
  it('스키마에서 숫자 비교를 찾아낸다', () => {
    // 탐지기가 조용히 아무것도 못 잡으면 아래 단언들이 전부 공회전한다.
    expect(BOUNDED.length).toBeGreaterThan(0)
    expect(ceilingOf('CHECK (((sort_order >= 0) AND (sort_order <= 4)))')).toBe(4)
    expect(ceilingOf("CHECK ((status = ANY (ARRAY['owned'::text])))")).toBeNull()

    // ceilingOf가 모르는 모양들. 계상에서 빠지는 게 아니라 항목을 요구해야 한다.
    expect(comparesToNumber('CHECK ((length(title) < 101))')).toBe(true)
    expect(comparesToNumber('CHECK ((101 > length(title)))')).toBe(true)
    expect(comparesToNumber('CHECK ((sort_order BETWEEN 0 AND 4))')).toBe(true)
    expect(comparesToNumber("CHECK ((colors <@ ARRAY['black'::text]))")).toBe(false)
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

  it('숫자 비교를 하는 모든 제약이 미러링되거나 면제되어 있다', () => {
    const unaccounted = BOUNDED.map(([name]) => name).filter(
      (name) => !(name in MIRRORED) && !(name in UNMIRRORED),
    )
    expect(
      unaccounted,
      '숫자를 비교하는 제약이 새로 생겼다. 상한이면 폼에서 미리 막고, 아니면 ' +
        'UNMIRRORED에 이유를 적을 것 — 막지 않으면 사진을 다 올린 뒤 INSERT에서 죽는다',
    ).toEqual([])
  })

  it.each(Object.entries(SET_MIRRORED))('%s 의 집합이 스키마와 같다', (name, mirrored) => {
    const definition = DB_CONSTRAINT_DEFS[name as keyof typeof DB_CONSTRAINT_DEFS]
    expect(definition, `${name}이 스키마에 없음 — 이름이 바뀌었거나 사라졌다`).toBeDefined()
    expect(setOf(definition)).toEqual([...mirrored].sort())
  })

  it('집합을 검사하는 모든 제약이 미러링되거나 면제되어 있다', () => {
    const unaccounted = SETS.map(([name]) => name).filter(
      (name) => !(name in SET_MIRRORED) && !(name in SET_UNMIRRORED),
    )
    expect(
      unaccounted,
      '허용값 목록을 검사하는 제약이 새로 생겼다. 클라이언트 목록과 묶든지, ' +
        'SET_UNMIRRORED에 이유를 적을 것 — 상한과 같은 막다른 길이 열린다',
    ).toEqual([])
  })

  it('면제한 집합 제약도 실제로 존재한다', () => {
    const stale = Object.keys(SET_UNMIRRORED).filter((name) => !(name in DB_CONSTRAINT_DEFS))
    expect(stale, '스키마에 없는 제약을 면제하고 있음').toEqual([])
  })

  it('제약 이름이 스키마 안에서 유일하다', () => {
    // conname은 테이블 단위로만 유니크하다. 두 테이블이 같은 이름을 쓰면
    // DB_CONSTRAINTS(배열)는 둘 다 갖고 DB_CONSTRAINT_DEFS(객체)는 나중 것만
    // 남겨서, 위 검사들이 사라진 쪽을 못 본다. 지금은 이름이 전부 테이블
    // 접두사라 안 겹치고, 세 번째 테이블이 created_at_check 같은 관용적인
    // 이름을 들고 올 때 열린다.
    expect(Object.keys(DB_CONSTRAINT_DEFS)).toHaveLength(DB_CONSTRAINTS.length)
  })
})
