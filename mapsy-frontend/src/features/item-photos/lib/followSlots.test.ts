import { describe, expect, it } from 'vitest'

import { indexAfterChange } from './followSlots'

const slots = (ids: string) => [...ids].map((id) => ({ id }))

describe('indexAfterChange', () => {
  it('컬렉션이 그대로면 움직이지 않는다', () => {
    // 재서명은 슬롯을 새 배열로 만들지만 사진은 그대로다. 여기서 goTo를 부르면
    // 매번 트랙을 다시 쓰고 뒤 화면에 페이지 변경을 알린다.
    expect(indexAfterChange(slots('ABCDE'), 'C', 2)).toBeNull()
  })

  it('앞의 사진이 지워지면 보던 사진을 따라간다', () => {
    // 이게 조용한 쪽이다 — 길이만 줄고 인덱스는 범위 안이라, 따라가지 않으면
    // 스와이프하지 않았는데 화면의 사진이 D로 바뀐다.
    expect(indexAfterChange(slots('BCDE'), 'C', 2)).toBe(1)
  })

  it('앞의 사진이 여러 장 지워져도 따라간다', () => {
    expect(indexAfterChange(slots('DE'), 'D', 3)).toBe(0)
  })

  it('뒤의 사진이 지워지면 움직이지 않는다', () => {
    expect(indexAfterChange(slots('ABCD'), 'C', 2)).toBeNull()
  })

  it('앞에 사진이 끼어들어도 따라간다', () => {
    expect(indexAfterChange(slots('ZABCDE'), 'C', 2)).toBe(3)
  })

  it('보던 사진이 지워지면 그 자리를 이어받은 사진으로 간다', () => {
    // 위치를 지키는 쪽 — 사라진 자리에 들어온 다음 사진이다.
    expect(indexAfterChange(slots('ABDE'), 'C', 2)).toBeNull()
  })

  it('보던 마지막 사진이 지워지면 새 마지막으로 클램프한다', () => {
    // 클램프가 없으면 인덱스가 끝을 넘어가 트랙이 빈 페이지에 남고 카운터가
    // "5 / 4"가 된다.
    expect(indexAfterChange(slots('ABCD'), 'E', 4)).toBe(3)
  })

  it('사진이 전부 사라지면 아무것도 하지 않는다', () => {
    expect(indexAfterChange([], 'C', 2)).toBeNull()
  })

  it('아직 자리를 잡기 전에는 현재 위치를 지킨다', () => {
    // seating 이펙트가 이 이펙트보다 먼저 선언돼 있어 실제로는 shownId가 이미
    // 채워져 있지만, 순서에 기대지 않고도 마운트 프레임에 화면을 흔들지 않는다.
    expect(indexAfterChange(slots('ABCDE'), null, 0)).toBeNull()
  })
})
