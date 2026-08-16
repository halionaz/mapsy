import { describe, expect, it } from 'vitest'
import { attachWears, itemIdsWornOn, summarizeWears } from './wearStats'
import type { WearEntry } from '../model/types'

const wears: WearEntry[] = [
  { itemId: 'a', wornOn: '2026-08-10' },
  { itemId: 'b', wornOn: '2026-08-10' },
  { itemId: 'a', wornOn: '2026-08-14' },
  { itemId: 'a', wornOn: '2026-07-02' },
]

describe('summarizeWears', () => {
  it('옷마다 개수를 세고 가장 최근 날을 지킨다', () => {
    const summary = summarizeWears(wears)
    expect(summary.get('a')).toEqual({ wearCount: 3, lastWornOn: '2026-08-14' })
    expect(summary.get('b')).toEqual({ wearCount: 1, lastWornOn: '2026-08-10' })
  })

  it('행이 어떤 순서로 오든 상관없다', () => {
    // 가져오기는 최신순으로 정렬하지만 제출 뒤의 캐시 패치는 뒤에 붙인다 — 순서를 믿는
    // 구현은 세션의 첫 기록까지만 맞고 그 뒤로 틀린다.
    const summary = summarizeWears([...wears].reverse())
    expect(summary.get('a')?.lastWornOn).toBe('2026-08-14')
  })

  it('날을 문자열로 비교한다 — 이 형식에서는 정확하다', () => {
    // 0으로 채운 고정 폭이라 사전순이 곧 달력순이다. 순진한 숫자 비교나 부분 비교를
    // 깨뜨리는 경우가 연도 경계다.
    const summary = summarizeWears([
      { itemId: 'a', wornOn: '2025-12-31' },
      { itemId: 'a', wornOn: '2026-01-01' },
    ])
    expect(summary.get('a')?.lastWornOn).toBe('2026-01-01')
  })

  it('항목이 없는 옷에는 할 말이 없다', () => {
    expect(summarizeWears([]).get('a')).toBeUndefined()
  })
})

describe('attachWears', () => {
  it('한 번도 안 입은 것까지 모든 옷에 요약을 준다', () => {
    // 필드가 없으면 그것을 읽는 세 곳에서 각각 null 검사를 해야 하고, 그중 하나는
    // 비교 함수다.
    const attached = attachWears([{ id: 'a' }, { id: 'z' }], wears)
    expect(attached).toEqual([
      { id: 'a', wearCount: 3, lastWornOn: '2026-08-14' },
      { id: 'z', wearCount: 0, lastWornOn: null },
    ])
  })

  it('건네받은 옷을 바꾸지 않는다', () => {
    const items = [{ id: 'a', title: '니트' }]
    attachWears(items, wears)
    expect(items[0]).toEqual({ id: 'a', title: '니트' })
  })

  it('받은 순서를 지킨다', () => {
    // 목록은 `applyFilters`가 정렬해서 오고, 여기서 다시 정렬하면 그것을 되돌린다.
    expect(attachWears([{ id: 'b' }, { id: 'a' }], wears).map((i) => i.id)).toEqual(['b', 'a'])
  })
})

describe('itemIdsWornOn', () => {
  it('하루만, 그리고 그 하루만 모은다', () => {
    // 이것이 돌려주는 집합이 그날을 *갈아치우는* 제출의 선택을 채우므로, 이웃한 날짜가
    // 새어 들어오면 그 위에 다시 쓰인다.
    expect([...itemIdsWornOn(wears, '2026-08-10')].sort()).toEqual(['a', 'b'])
    expect([...itemIdsWornOn(wears, '2026-08-14')]).toEqual(['a'])
  })

  it('아무것도 없는 날에는 비어 있다', () => {
    expect(itemIdsWornOn(wears, '2026-08-15').size).toBe(0)
  })
})
