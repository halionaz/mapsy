/**
 * 격자를 재정렬하는 동안 각 사진이 어디에 그려지는지.
 *
 * 전부 측정이 아니라 슬롯 번호 산술이다. 타일이 균일한 격자라 "손가락 아래가 몇 번
 * 슬롯인가"와 "이 타일이 얼마나 밀렸는가"가 pitch 하나와 열 수 하나로 답해진다. 대안인
 * pointermove마다 타일별 `getBoundingClientRect`는, transform을 쓰고 있는 제스처 한가운데서
 * 레이아웃을 읽는 모양이다.
 *
 * 기하는 끌기마다 *한 번* 재고, 스타일시트에서 베끼지 않고 computed style에서 읽는다.
 * 타일 크기와 간격은 Panda의 것이고, 84의 두 번째 사본은 타일 크기가 바뀌는 날 조용히
 * 틀리는 값이다.
 */

import { clamp } from '@/shared/lib/clamp'

export interface GridGeometry {
  /** 이웃한 슬롯 사이의 거리 — 타일 하나 더하기 간격 하나. */
  pitch: number
  columns: number
  /**
   * 격자의 좌상단을 **페이지** 좌표로.
   *
   * 뷰포트 좌표가 아니다. 타일이 들리는 순간 한 번만 재는데, 마우스 끌기는 그 아래에서
   * 페이지를 스크롤할 수 있다 — 휠은 막지 않고 터치 패닝만 막는다.
   */
  left: number
  top: number
}

/** 격자를 잴 수 없으면 `null` — 레이아웃이 없는 환경 전부가 그렇다. */
export function readGridGeometry(element: HTMLElement): GridGeometry | null {
  const style = getComputedStyle(element)
  // *사용된* 트랙 목록 — `repeat(auto-fill, 84px)`가 "84px 84px …"로 풀리므로 열 수와
  // 타일 크기를 동시에 준다. 레이아웃이 없는 요소는 `none`이나 빈 문자열로 답하고,
  // 둘 다 아래에서 NaN으로 떨어진다.
  const tracks = style.gridTemplateColumns.split(' ').filter(Boolean)
  const tile = Number.parseFloat(tracks[0] ?? '')
  // 스타일시트는 `gap` 단축을 쓰지만 여기서는 롱핸드를 읽는다. 브라우저는 하나를 다른
  // 하나로 풀지만 jsdom은 단축을 펼치지 않으므로, 옆 테스트가 `column-gap`을 직접 심는다.
  // 격자의 gap을 인라인으로 쓰는 것이 없는 한 안전하다.
  const gap = Number.parseFloat(style.columnGap)

  if (!Number.isFinite(tile) || !Number.isFinite(gap)) return null

  const rect = element.getBoundingClientRect()
  return {
    pitch: tile + gap,
    columns: tracks.length,
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
  }
}

/**
 * 이 타일이 움직이는 데 걸리는 시간, 밀리초.
 *
 * 놓기는 타이머로 확정되고 타이머는 트랜지션보다 오래 살아야 한다 — 아니면 transform이
 * 도중에 지워져 타일이 튄다. 토큰이 아니라 *요소*에서 읽는 것은
 * `prefers-reduced-motion`을 함께 답하게 하기 위해서다.
 *
 * 단위 표기 둘 다 다루지만 브라우저의 것은 초뿐이다. `ms`는 인라인 값을 정규화 없이
 * 넘기는 jsdom의 것이라, 그 가지는 테스트가 딛고 선 자리다.
 *
 * 0은 실패가 아니라 답이다 — 트랜지션 없는 타일은 기다릴 것이 없다.
 */
export function readTransitionMs(element: HTMLElement): number {
  const raw = getComputedStyle(element).transitionDuration.trim()
  const amount = Number.parseFloat(raw)
  if (!Number.isFinite(amount)) return 0
  return raw.endsWith('ms') ? amount : amount * 1000
}

/** 한 점 아래의 슬롯 — 격자와 같은 페이지 좌표 — 사진이 있는 슬롯으로 가둔다. */
export function slotAt(point: { x: number; y: number }, grid: GridGeometry, count: number): number {
  const column = clamp(Math.floor((point.x - grid.left) / grid.pitch), 0, grid.columns - 1)
  const row = Math.max(0, Math.floor((point.y - grid.top) / grid.pitch))
  return clamp(row * grid.columns + column, 0, count - 1)
}

/** 슬롯 `to`가 슬롯 `from`에서 얼마나 떨어져 있는지. */
export function slotOffset(
  from: number,
  to: number,
  grid: GridGeometry | null,
): { x: number; y: number } {
  if (!grid) return { x: 0, y: 0 }
  return {
    x: ((to % grid.columns) - (from % grid.columns)) * grid.pitch,
    y: (Math.floor(to / grid.columns) - Math.floor(from / grid.columns)) * grid.pitch,
  }
}

/**
 * `from`의 사진이 `to` 위에 떠 있는 동안 `index`의 사진이 그려지는 슬롯.
 *
 * 두 끝 사이의 것들이 `to`에 자리를 내주는 방향으로 하나씩 밀린다. 그 범위 밖은 움직이지
 * 않으므로, 다섯 장짜리 행을 가로질러 끌어도 실제로 지나친 사진만 움직인다.
 */
export function displaySlot(index: number, from: number, to: number): number {
  if (index === from) return to
  if (from < to) return index > from && index <= to ? index - 1 : index
  return index >= to && index < from ? index + 1 : index
}

/** 항목 하나를 들어내 `to`에 다시 놓은 목록. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
