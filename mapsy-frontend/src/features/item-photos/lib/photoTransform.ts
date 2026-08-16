/**
 * 사진 뷰어 제스처 뒤의 기하.
 *
 * 컴포넌트에서 떼어낸 것은, 코드를 읽어서는 드러나지 않는 방식으로 틀릴 수 있는 부분이기
 * 때문이다 — 핀치 내내 사진이 손가락 아래 머무는지, 가장자리를 틀 안으로 끌 수 있는지,
 * 튕김이 넘어갈 만큼 멀었는지. 렌더로는 확인할 수 없고 숫자를 넣고 숫자를 받아야 한다.
 *
 * 여기 모든 좌표는 **틀의 중앙** 기준이다. 사진의 transform-origin이 거기 있다.
 * `{x: 0, y: 0}`은 화면 왼쪽 위가 아니라 한가운데다.
 */

import { clamp } from '@/shared/lib/clamp'

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

/** `translate(x, y) scale(scale)` 순서 — `x`/`y`는 사진 픽셀이 아니라 배율 뒤의 화면 픽셀이다. */
export interface Transform {
  scale: number
  x: number
  y: number
}

export const MIN_SCALE = 1
export const MAX_SCALE = 4
export const DOUBLE_TAP_SCALE = 2.5
/** 핀치는 1에서 살짝 어긋난 채 멈춘다. 이 안은 "확대 안 됨"으로 센다. */
export const ZOOM_EPSILON = 0.01
/** 틀의 이 비율만큼 끌고 놓으면 페이지가 넘어간다. */
export const PAGE_THRESHOLD = 0.22
/** 첫 장이나 마지막 장을 넘어선 끌기가 실제로 트랙을 움직이는 비율. */
export const EDGE_RESISTANCE = 0.35

export const IDENTITY: Transform = { scale: MIN_SCALE, x: 0, y: 0 }

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function isZoomed(transform: Transform): boolean {
  return transform.scale > MIN_SCALE + ZOOM_EPSILON
}

/**
 * 지금 `point` 아래에 있는 사진 좌표 — transform의 역이다.
 *
 * 핀치가 시작될 때 잡아 그동안 고정한다. 그것이 사진을 자기 중앙이 아니라 손가락을
 * 중심으로 확대하게 만든다.
 */
export function focusOf(point: Point, transform: Transform): Point {
  return {
    x: (point.x - transform.x) / transform.scale,
    y: (point.y - transform.y) / transform.scale,
  }
}

/** 사진 좌표 `focus`를 `at` 아래에 붙들어 둔 채 `scale`로 확대한다. */
export function transformAround(focus: Point, at: Point, scale: number): Transform {
  return { scale, x: at.x - focus.x * scale, y: at.y - focus.y * scale }
}

/**
 * `point`에 있는 것을 틀 한가운데로 데려오면서 `scale`로 확대한다.
 *
 * 원래 크기에서만 맞는다 — 그때만 점 아래의 사진 좌표가 점 자신이고, 더블탭이 확대를
 * 시작할 수 있는 곳도 거기뿐이다.
 */
export function transformToCenter(point: Point, scale: number): Transform {
  return transformAround(point, { x: 0, y: 0 }, scale)
}

/** 핀치가 시작점 대비 어디까지 왔는지. */
export function pinchScale(startDistance: number, currentDistance: number, startScale: number) {
  return clamp((currentDistance / Math.max(1, startDistance)) * startScale, MIN_SCALE, MAX_SCALE)
}

/**
 * 사진이 보고 있는 틀 밖으로 끌려나가지 않게 한다.
 *
 * 어느 축으로든 틀보다 작은 사진은 그 축으로 움직일 수 없어서, 경계가 음수로 가지 않고
 * 0에서 바닥을 친다.
 */
export function clampToBounds(transform: Transform, photo: Size, frame: Size): Transform {
  const maxX = Math.max(0, (photo.width * transform.scale - frame.width) / 2)
  const maxY = Math.max(0, (photo.height * transform.scale - frame.height) / 2)
  return {
    scale: transform.scale,
    x: clamp(transform.x, -maxX, maxX),
    y: clamp(transform.y, -maxY, maxY),
  }
}

/**
 * `dx`만큼의 끌기에 트랙이 실제로 얼마나 움직여야 하는지.
 *
 * 첫 장이나 마지막 장을 넘어서도 마지못해 밀린다 — 반응 없는 화면은 고장 난 화면과
 * 구분되지 않지만, 당겼다 되돌아오는 페이지는 "이쪽엔 없다"고 스스로 말한다.
 */
export function resistEdge(dx: number, index: number, count: number): number {
  const atFirst = index === 0 && dx > 0
  // `pageAfterSwipe`가 필요로 하는 것과 같은 이유의 `Math.max` — 사진이 없으면 마지막
  // 인덱스가 -1이고 어떤 인덱스와도 같지 않아, 하나뿐인 페이지가 양방향으로 자유롭게 끌린다.
  const atLast = index === Math.max(0, count - 1) && dx < 0
  return atFirst || atLast ? dx * EDGE_RESISTANCE : dx
}

/**
 * `dx`만큼의 스와이프를 놓았을 때 앉을 사진.
 *
 * 마지막 인덱스에 `Math.max`가 붙은 것은 빈 집합에 마지막 인덱스가 없기 때문이다.
 * `count - 1`은 -1이고 0보다 *낮은* 경계라, 0과 -1 사이로 가두면 -1이 나온다 —
 * 트랙 앞으로 벗어난 페이지이고 뷰어는 거기로 가서 돌아오지 못한다.
 */
export function pageAfterSwipe(index: number, dx: number, frameWidth: number, count: number) {
  if (Math.abs(dx) <= frameWidth * PAGE_THRESHOLD) return index
  return clamp(index + (dx < 0 ? 1 : -1), 0, Math.max(0, count - 1))
}
