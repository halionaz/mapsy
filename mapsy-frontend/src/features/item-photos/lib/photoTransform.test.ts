import { describe, expect, it } from 'vitest'

import {
  DOUBLE_TAP_SCALE,
  IDENTITY,
  MAX_SCALE,
  clampToBounds,
  focusOf,
  isZoomed,
  pageAfterSwipe,
  pinchScale,
  resistEdge,
  transformAround,
  transformToCenter,
  type Point,
  type Transform,
} from './photoTransform'

/** transform 아래에서 사진 좌표가 화면의 어디로 가는지. */
function project(photoPoint: Point, transform: Transform): Point {
  return {
    x: photoPoint.x * transform.scale + transform.x,
    y: photoPoint.y * transform.scale + transform.y,
  }
}

const FRAME = { width: 400, height: 600 }
/** `object-fit`이 남기는 대로, 틀에 레터박스된 가로 사진. */
const PHOTO = { width: 400, height: 300 }

describe('focusOf', () => {
  it('사진이 원래 크기면 점을 그 자신으로 읽는다', () => {
    expect(focusOf({ x: 60, y: -20 }, IDENTITY)).toEqual({ x: 60, y: -20 })
  })

  it('받은 transform을 뒤집는다', () => {
    const transform = { scale: 2.5, x: 40, y: -15 }
    const focus = focusOf({ x: 90, y: 35 }, transform)
    expect(project(focus, transform)).toEqual({ x: 90, y: 35 })
  })
})

describe('transformAround', () => {
  it('배율이 바뀌어도 집힌 점을 붙들어 둔다', () => {
    const fingers = { x: 120, y: -80 }
    let transform: Transform = IDENTITY
    const focus = focusOf(fingers, transform)

    // 양끝만이 아니라 핀치 내내. 제스처 도중에 초점을 다시 계산하는 순간 깨지는 성질이다.
    for (const scale of [1.2, 1.8, 2.6, 3.4, MAX_SCALE]) {
      transform = transformAround(focus, fingers, scale)
      const projected = project(focus, transform)
      expect(projected.x).toBeCloseTo(fingers.x)
      expect(projected.y).toBeCloseTo(fingers.y)
    }
  })

  it('핀치하며 움직이는 손가락을 따라간다', () => {
    const start = { x: 30, y: 30 }
    const focus = focusOf(start, IDENTITY)
    const moved = { x: -50, y: 10 }

    const transform = transformAround(focus, moved, 2)
    expect(project(focus, transform)).toEqual(moved)
  })
})

describe('transformToCenter', () => {
  it('더블탭한 점을 틀 한가운데로 데려온다', () => {
    const tapped = { x: 140, y: -90 }
    const transform = transformToCenter(tapped, DOUBLE_TAP_SCALE)

    expect(project(tapped, transform)).toEqual({ x: 0, y: 0 })
    expect(transform.scale).toBe(DOUBLE_TAP_SCALE)
  })

  it('가운데를 탭하면 그대로 둔다', () => {
    expect(transformToCenter({ x: 0, y: 0 }, DOUBLE_TAP_SCALE)).toEqual({
      scale: DOUBLE_TAP_SCALE,
      x: 0,
      y: 0,
    })
  })
})

describe('pinchScale', () => {
  it('손가락 사이 거리에 따라 배율이 변한다', () => {
    expect(pinchScale(100, 200, 1)).toBe(2)
    expect(pinchScale(100, 50, 2)).toBe(1)
  })

  it('원래 크기 아래로도 상한 위로도 가지 않는다', () => {
    expect(pinchScale(100, 10, 1)).toBe(1)
    expect(pinchScale(100, 10_000, 2)).toBe(MAX_SCALE)
  })

  it('손가락이 붙은 채 시작한 핀치를 견딘다', () => {
    expect(Number.isFinite(pinchScale(0, 120, 1))).toBe(true)
  })
})

describe('clampToBounds', () => {
  it('틀에 들어맞는 사진을 가운데에 고정한다', () => {
    const clamped = clampToBounds({ scale: 1, x: 90, y: 40 }, PHOTO, FRAME)
    expect(clamped).toEqual({ scale: 1, x: 0, y: 0 })
  })

  it('넘치는 만큼만 딱 허용한다', () => {
    // 2배에서 사진은 400×600 틀 안의 800×600이다 — 좌우로 200px 여유, 상하로는 없음.
    const clamped = clampToBounds({ scale: 2, x: 500, y: 500 }, PHOTO, FRAME)
    expect(clamped).toEqual({ scale: 2, x: 200, y: 0 })
  })

  it('양방향을 대칭으로 가둔다', () => {
    expect(clampToBounds({ scale: 2, x: -500, y: 0 }, PHOTO, FRAME).x).toBe(-200)
  })

  it('이미 안에 있는 이동은 건드리지 않는다', () => {
    expect(clampToBounds({ scale: 2, x: 120, y: 0 }, PHOTO, FRAME).x).toBe(120)
  })
})

describe('isZoomed', () => {
  it('핀치가 남긴 반올림을 무시한다', () => {
    expect(isZoomed({ scale: 1.005, x: 0, y: 0 })).toBe(false)
    expect(isZoomed({ scale: 1.5, x: 0, y: 0 })).toBe(true)
  })
})

describe('resistEdge', () => {
  it('사진 사이의 끌기는 그대로 통과시킨다', () => {
    expect(resistEdge(-120, 1, 3)).toBe(-120)
    expect(resistEdge(120, 1, 3)).toBe(120)
  })

  it('양 끝을 넘어선 끌기는 붙든다', () => {
    expect(Math.abs(resistEdge(120, 0, 3))).toBeLessThan(120)
    expect(Math.abs(resistEdge(-120, 2, 3))).toBeLessThan(120)
  })

  it('마지막 사진도 뒤로는 끌 수 있게 둔다', () => {
    expect(resistEdge(120, 2, 3)).toBe(120)
  })

  it('사진이 없으면 양방향 모두 붙든다', () => {
    expect(Math.abs(resistEdge(120, 0, 0))).toBeLessThan(120)
    expect(Math.abs(resistEdge(-120, 0, 0))).toBeLessThan(120)
  })
})

describe('pageAfterSwipe', () => {
  const WIDTH = 400

  it('살짝 민 정도의 끌기에는 제자리에 있는다', () => {
    expect(pageAfterSwipe(1, -40, WIDTH, 3)).toBe(1)
  })

  it('왼쪽으로 끌면 나아가고 오른쪽으로 끌면 물러난다', () => {
    expect(pageAfterSwipe(1, -200, WIDTH, 3)).toBe(2)
    expect(pageAfterSwipe(1, 200, WIDTH, 3)).toBe(0)
  })

  it('양 끝을 벗어나게 끌 수 없다', () => {
    expect(pageAfterSwipe(0, 300, WIDTH, 3)).toBe(0)
    expect(pageAfterSwipe(2, -300, WIDTH, 3)).toBe(2)
  })

  it('사진이 하나뿐이면 아무 데도 가지 않는다', () => {
    expect(pageAfterSwipe(0, -300, WIDTH, 1)).toBe(0)
  })

  it('사진이 아예 없으면 첫 페이지에 머문다', () => {
    // -1이 아니다 — 여기서 `count - 1`은 0보다 낮은 경계이고, 첫 페이지 앞의 페이지는
    // 트랙이 되돌아올 수 없는 자리다.
    expect(pageAfterSwipe(0, -300, WIDTH, 0)).toBe(0)
    expect(pageAfterSwipe(0, 300, WIDTH, 0)).toBe(0)
  })
})
