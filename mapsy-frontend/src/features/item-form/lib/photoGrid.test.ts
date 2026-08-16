/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'

import {
  displaySlot,
  moveItem,
  readGridGeometry,
  readTransitionMs,
  slotAt,
  slotOffset,
  type GridGeometry,
} from './photoGrid'

/**
 * 끌기를 이루는 산술.
 *
 * 어느 것도 그 결과 화면을 봐서는 확인할 수 없다 — 한 칸 어긋난 타일은, 손가락 위치와
 * 비교하기 전까지 제자리 타일과 똑같이 생겼다. 그래서 규칙을 여기서 붙들고, 위
 * 컴포넌트는 이것이 돌려주는 자리에 놓기만 한다.
 */

// 12px 간격의 84px 타일 세 열, 원점에서 시작.
const grid: GridGeometry = { pitch: 96, columns: 3, left: 0, top: 0 }

describe('displaySlot', () => {
  it('목표 자리에 틈을 내고 지나친 것들을 민다', () => {
    // 0을 2 위로 끌면 지나친 둘이 한 칸씩 물러난다.
    expect([0, 1, 2, 3].map((i) => displaySlot(i, 0, 2))).toEqual([2, 0, 1, 3])
  })

  it('사진이 커버 쪽으로 가면 반대 방향으로 민다', () => {
    expect([0, 1, 2, 3].map((i) => displaySlot(i, 3, 1))).toEqual([0, 2, 3, 1])
  })

  it('사진이 자기 슬롯 위에 있으면 아무것도 건드리지 않는다', () => {
    expect([0, 1, 2, 3].map((i) => displaySlot(i, 2, 2))).toEqual([0, 1, 2, 3])
  })
})

describe('slotOffset', () => {
  it('행을 가로질러 잰다', () => {
    expect(slotOffset(0, 2, grid)).toEqual({ x: 192, y: 0 })
  })

  it('열을 내려가고 행을 되짚어 잰다', () => {
    // 슬롯 0은 1행의 첫째, 슬롯 4는 2행의 둘째.
    expect(slotOffset(0, 4, grid)).toEqual({ x: 96, y: 96 })
  })

  it('잴 것이 없으면 가만히 있는다', () => {
    // 레이아웃이 없는 모든 환경 — 타일이 그냥 움직이지 않는다.
    expect(slotOffset(0, 4, null)).toEqual({ x: 0, y: 0 })
  })
})

describe('slotAt', () => {
  it('점이 들어 있는 슬롯으로 답한다', () => {
    expect(slotAt({ x: 100, y: 10 }, grid, 5)).toBe(1)
    expect(slotAt({ x: 20, y: 100 }, grid, 5)).toBe(3)
  })

  it('손가락이 아무리 멀리 가도 마지막 사진을 넘지 않는다', () => {
    // 행의 빈 꼬리와 추가 타일은 사진이 앉을 수 있는 슬롯이 아니다.
    expect(slotAt({ x: 280, y: 100 }, grid, 5)).toBe(4)
    expect(slotAt({ x: 900, y: 900 }, grid, 5)).toBe(4)
  })

  it('커버보다 앞에도 앉지 않는다', () => {
    expect(slotAt({ x: -400, y: -400 }, grid, 5)).toBe(0)
  })
})

describe('readGridGeometry', () => {
  function gridElement(): HTMLElement {
    const element = document.createElement('div')
    element.style.gridTemplateColumns = '84px 84px 84px'
    element.style.columnGap = '12px'
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
    } as DOMRect)
    document.body.append(element)
    return element
  }

  it('사용된 트랙 목록에서 pitch와 열 수를 읽는다', () => {
    // 스타일시트에서 베끼지 않는다 — `repeat(auto-fill, 84px)`가 실제로 배치된 트랙으로
    // 풀리므로, 타일 크기가 바뀌어도 살아남는다.
    const grid = readGridGeometry(gridElement())
    expect(grid?.pitch).toBe(96)
    expect(grid?.columns).toBe(3)
  })

  it('페이지 좌표로 답해서, 끌기 도중 스크롤이 슬롯을 옮기지 않는다', () => {
    // 끌기가 하는 유일한 측정이고, 들어올릴 때 한 번 한다. 뷰포트 좌표였다면 마우스
    // 휠이 — 터치 패닝과 달리 막히지 않는다 — 남은 끌기 내내 모든 슬롯을 포인터
    // 아래에서 밀어냈을 것이다.
    const scrolled = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(100)
    try {
      expect(readGridGeometry(gridElement())).toMatchObject({ left: 10, top: 120 })
    } finally {
      scrolled.mockRestore()
    }
  })

  it('레이아웃 없는 요소에는 격자를 지어내지 않고 포기한다', () => {
    expect(readGridGeometry(document.createElement('div'))).toBeNull()
  })
})

describe('readTransitionMs', () => {
  function tile(duration: string): HTMLElement {
    const element = document.createElement('div')
    element.style.transitionDuration = duration
    document.body.append(element)
    return element
  }

  /**
   * 초 쪽이 브라우저의 것이다 — computed `<time>`은 스타일시트가 어떻게 썼든 초로
   * 직렬화된다 — 그리고 `panda.config.ts`에 `200ms`가 그대로 적혀 있어 죽은 코드처럼
   * 읽히는 쪽이기도 하다. 그렇게 읽고 지우면 모든 놓기가 0.2밀리초 만에 확정되고 타일이 튄다.
   */
  it('브라우저가 보고하는 초를 읽는다', () => {
    expect(readTransitionMs(tile('.2s'))).toBe(200)
  })

  it('jsdom이 돌려주는 밀리초를 읽는다', () => {
    // 정규화되지 않은 인라인 값. 그래서 위 테스트들이 어느 표기 위에도 설 수 있다.
    expect(readTransitionMs(tile('200ms'))).toBe(200)
  })

  it('기다릴 것이 없는 타일에는 0으로 답한다', () => {
    // 스타일시트도 트랜지션도 없어 넘어설 것이 없다 — 실패가 아니라 진짜 답이고,
    // 놓기가 목록을 곧장 다시 쓸 수 있다는 뜻이다.
    expect(readTransitionMs(document.createElement('div'))).toBe(0)
  })
})

describe('moveItem', () => {
  it('하나를 들어내 목표 자리에 다시 놓는다', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('출발한 자리에 앉으면 목록을 건드리지 않는다', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })
})
