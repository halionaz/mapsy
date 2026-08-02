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

/** Where a photo coordinate ends up on screen under a transform. */
function project(photoPoint: Point, transform: Transform): Point {
  return {
    x: photoPoint.x * transform.scale + transform.x,
    y: photoPoint.y * transform.scale + transform.y,
  }
}

const FRAME = { width: 400, height: 600 }
/** A landscape photo letterboxed into the frame, as `object-fit` leaves it. */
const PHOTO = { width: 400, height: 300 }

describe('focusOf', () => {
  it('reads a point as itself when the photo is at rest', () => {
    expect(focusOf({ x: 60, y: -20 }, IDENTITY)).toEqual({ x: 60, y: -20 })
  })

  it('inverts the transform it is given', () => {
    const transform = { scale: 2.5, x: 40, y: -15 }
    const focus = focusOf({ x: 90, y: 35 }, transform)
    expect(project(focus, transform)).toEqual({ x: 90, y: 35 })
  })
})

describe('transformAround', () => {
  it('holds the pinched point still as the scale changes', () => {
    const fingers = { x: 120, y: -80 }
    let transform: Transform = IDENTITY
    const focus = focusOf(fingers, transform)

    // The whole way through a pinch, not just at the ends: this is the property
    // that fails as soon as the focal point is recomputed mid-gesture.
    for (const scale of [1.2, 1.8, 2.6, 3.4, MAX_SCALE]) {
      transform = transformAround(focus, fingers, scale)
      const projected = project(focus, transform)
      expect(projected.x).toBeCloseTo(fingers.x)
      expect(projected.y).toBeCloseTo(fingers.y)
    }
  })

  it('follows fingers that move while they pinch', () => {
    const start = { x: 30, y: 30 }
    const focus = focusOf(start, IDENTITY)
    const moved = { x: -50, y: 10 }

    const transform = transformAround(focus, moved, 2)
    expect(project(focus, transform)).toEqual(moved)
  })
})

describe('transformToCenter', () => {
  it('brings the double-tapped point to the middle of the frame', () => {
    const tapped = { x: 140, y: -90 }
    const transform = transformToCenter(tapped, DOUBLE_TAP_SCALE)

    expect(project(tapped, transform)).toEqual({ x: 0, y: 0 })
    expect(transform.scale).toBe(DOUBLE_TAP_SCALE)
  })

  it('leaves a tap on the middle where it is', () => {
    expect(transformToCenter({ x: 0, y: 0 }, DOUBLE_TAP_SCALE)).toEqual({
      scale: DOUBLE_TAP_SCALE,
      x: 0,
      y: 0,
    })
  })
})

describe('pinchScale', () => {
  it('scales with the distance between the fingers', () => {
    expect(pinchScale(100, 200, 1)).toBe(2)
    expect(pinchScale(100, 50, 2)).toBe(1)
  })

  it('refuses to go below fit or above the ceiling', () => {
    expect(pinchScale(100, 10, 1)).toBe(1)
    expect(pinchScale(100, 10_000, 2)).toBe(MAX_SCALE)
  })

  it('survives a pinch that starts with the fingers together', () => {
    expect(Number.isFinite(pinchScale(0, 120, 1))).toBe(true)
  })
})

describe('clampToBounds', () => {
  it('pins a photo that fits the frame to the middle', () => {
    const clamped = clampToBounds({ scale: 1, x: 90, y: 40 }, PHOTO, FRAME)
    expect(clamped).toEqual({ scale: 1, x: 0, y: 0 })
  })

  it('allows exactly the overhang and no more', () => {
    // At 2x the photo is 800×600 in a 400×600 frame: 200px of slack sideways,
    // none at all vertically.
    const clamped = clampToBounds({ scale: 2, x: 500, y: 500 }, PHOTO, FRAME)
    expect(clamped).toEqual({ scale: 2, x: 200, y: 0 })
  })

  it('clamps both directions symmetrically', () => {
    expect(clampToBounds({ scale: 2, x: -500, y: 0 }, PHOTO, FRAME).x).toBe(-200)
  })

  it('leaves a pan that is already inside alone', () => {
    expect(clampToBounds({ scale: 2, x: 120, y: 0 }, PHOTO, FRAME).x).toBe(120)
  })
})

describe('isZoomed', () => {
  it('ignores the rounding a pinch leaves behind', () => {
    expect(isZoomed({ scale: 1.005, x: 0, y: 0 })).toBe(false)
    expect(isZoomed({ scale: 1.5, x: 0, y: 0 })).toBe(true)
  })
})

describe('resistEdge', () => {
  it('passes a drag between photos straight through', () => {
    expect(resistEdge(-120, 1, 3)).toBe(-120)
    expect(resistEdge(120, 1, 3)).toBe(120)
  })

  it('holds back a drag past either end', () => {
    expect(Math.abs(resistEdge(120, 0, 3))).toBeLessThan(120)
    expect(Math.abs(resistEdge(-120, 2, 3))).toBeLessThan(120)
  })

  it('still lets the last photo be dragged backwards', () => {
    expect(resistEdge(120, 2, 3)).toBe(120)
  })

  it('holds back both directions when there are no photos', () => {
    expect(Math.abs(resistEdge(120, 0, 0))).toBeLessThan(120)
    expect(Math.abs(resistEdge(-120, 0, 0))).toBeLessThan(120)
  })
})

describe('pageAfterSwipe', () => {
  const WIDTH = 400

  it('stays put when the drag was a nudge', () => {
    expect(pageAfterSwipe(1, -40, WIDTH, 3)).toBe(1)
  })

  it('advances on a drag to the left and retreats on one to the right', () => {
    expect(pageAfterSwipe(1, -200, WIDTH, 3)).toBe(2)
    expect(pageAfterSwipe(1, 200, WIDTH, 3)).toBe(0)
  })

  it('cannot be dragged off either end', () => {
    expect(pageAfterSwipe(0, 300, WIDTH, 3)).toBe(0)
    expect(pageAfterSwipe(2, -300, WIDTH, 3)).toBe(2)
  })

  it('goes nowhere when there is only one photo', () => {
    expect(pageAfterSwipe(0, -300, WIDTH, 1)).toBe(0)
  })

  it('stays on the first page when there are no photos at all', () => {
    // Not -1: `count - 1` is a lower bound than 0 here, and a page before the
    // first is one the track cannot scroll back from.
    expect(pageAfterSwipe(0, -300, WIDTH, 0)).toBe(0)
    expect(pageAfterSwipe(0, 300, WIDTH, 0)).toBe(0)
  })
})
