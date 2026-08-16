import { describe, expect, it } from 'vitest'

import { DB_CONSTRAINTS, DB_CONSTRAINT_DEFS } from '@/shared/config/dbConstraints.generated'
import { CATEGORY_GROUP_IDS } from '@/shared/config/categories'
import { COLOR_IDS, MAX_COLORS_PER_ITEM } from '@/shared/config/colors'
import { MAX_SEASONS_PER_ITEM, SEASON_IDS } from '@/shared/config/seasons'
import { LIMITS, MAX_PHOTOS } from './limits'

/**
 * 폼이 들고 있는 DB 상한의 사본을 스키마와 맞춰본다.
 *
 * 생성된 목록이 이름만 싣던 시절이 있었고, 어긋나는 것은 이름이 아니다 —
 * `items_price_max`는 이름을 지킨 채 옆의 숫자가 열 배 틀렸고, 그것을 찾은 것은 사진
 * 다섯 장을 이미 올린 사용자였다. 그래서 정의도 함께 생성하고, 거기 모든 상한이 여기서
 * 계상되어야 한다 — 미러링하거나, 일부러 안 한다고 이유와 함께 적거나.
 *
 * 중요한 것은 두 번째 방향이다. 마이그레이션에 상한을 더하는 것은 누구나 할 수 있고,
 * 이 파일의 존재를 아무도 기억할 필요가 없다 — 항목 없는 새 상한은 아래 마지막
 * 테스트에서 걸린다.
 */

/** `… <= N` CHECK의 N. 상한을 두지 않는 제약이면 null. */
function ceilingOf(definition: string): number | null {
  const match = /<=\s*(\d+)/.exec(definition)
  return match ? Number(match[1]) : null
}

/**
 * 이 제약이 숫자와 비교를 하기는 하는가.
 *
 * `ceilingOf`보다 일부러 느슨하고, 그 간극이 요점이다. `ceilingOf`는 `<= N`만 알아서
 * `length(x) < 101`이나 피연산자가 뒤집힌 것, `BETWEEN`은 상한을 내놓지 못하고 —
 * 상한 없는 제약은 계상에서 통째로 빠져 조용히 통과했다. 이것이 *항목이 필요한지*를
 * 정하고, `ceilingOf`는 그 항목이 무엇과 같아야 하는지만 정한다.
 */
function comparesToNumber(definition: string): boolean {
  return /(<=|>=|<|>)\s*\d+|\d+\s*(<=|>=|<|>)|\bBETWEEN\b/i.test(definition)
}

const BOUNDED = Object.entries(DB_CONSTRAINT_DEFS).filter(([, definition]) =>
  comparesToNumber(definition),
)

/**
 * `<@ ARRAY[…]`나 `= ANY (ARRAY[…])` CHECK이 허용하는 값들, 정렬해서.
 *
 * 같은 문제의 나머지 절반이다. 상한은 숫자 하나로 어긋나고 어휘는 원소 하나로 어긋나는데,
 * 두 번째가 실수로 하기 *더 쉽다* — `shared/config/colors.ts`에 색 하나를 더하면 폼에
 * 칩이 생기고, 그 파일에는 DB도 동의해야 한다고 말하는 것이 없다. 그러면 사진 다섯 장을
 * 다 올린 뒤 `items_colors_valid`에서 죽는다.
 *
 * 괄호 안으로 범위를 좁힌 것은 의도다. `items_category_group_valid`에는
 * `split_part(category_id, '.'::text, 1)`도 들어 있어서, 정의의 모든 인용 리터럴을 읽는
 * 패턴은 그 구분자를 아홉 번째 카테고리 그룹으로 끌고 온다.
 */
function setOf(definition: string): string[] | null {
  const array = /ARRAY\[([^\]]*)\]/.exec(definition)
  if (!array) return null
  return [...array[1].matchAll(/'([^']*)'::text/g)].map((match) => match[1]).sort()
}

const SETS = Object.entries(DB_CONSTRAINT_DEFS).filter(([, definition]) => setOf(definition))

/** 제약 이름 → 그 상한과 같아야 하는 클라이언트 쪽 숫자. */
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
  // 상한은 0부터 시작하는 `sort_order`에 걸려 있어, 마지막으로 쓸 수 있는 인덱스가
  // 피커가 받는 사진 수보다 하나 작다.
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
