/**
 * The geometry behind the photo viewer's gestures.
 *
 * Separated from the component because it is the part that can actually be
 * wrong in a way that reading the code will not reveal: whether the photo stays
 * under the fingers through a pinch, whether the edges can be dragged inside the
 * frame, whether a flick is far enough to count. None of that can be checked by
 * rendering — it needs numbers in and numbers out, which is what the tests
 * beside this file do.
 *
 * Every coordinate here is relative to the **centre of the frame**, because that
 * is where the photo's transform-origin sits. A point at `{x: 0, y: 0}` is the
 * middle of the screen, not its top-left.
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

/**
 * `translate(x, y) scale(scale)`, in that order — so `x`/`y` are screen pixels
 * measured after the scale, not photo pixels.
 */
export interface Transform {
  scale: number
  x: number
  y: number
}

export const MIN_SCALE = 1
export const MAX_SCALE = 4
export const DOUBLE_TAP_SCALE = 2.5
/** Pinches settle a hair off 1; anything inside this counts as "not zoomed". */
export const ZOOM_EPSILON = 0.01
/** Drag past this fraction of the frame and releasing turns the page. */
export const PAGE_THRESHOLD = 0.22
/** How much of a drag past the first or last photo actually moves the track. */
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
 * The photo coordinate currently under `point` — the inverse of the transform.
 *
 * Captured when a pinch starts and held still for its duration, which is what
 * makes the photo zoom around the fingers instead of around its middle.
 */
export function focusOf(point: Point, transform: Transform): Point {
  return {
    x: (point.x - transform.x) / transform.scale,
    y: (point.y - transform.y) / transform.scale,
  }
}

/** Scales to `scale` while keeping photo coordinate `focus` under `at`. */
export function transformAround(focus: Point, at: Point, scale: number): Transform {
  return { scale, x: at.x - focus.x * scale, y: at.y - focus.y * scale }
}

/**
 * Scales to `scale`, bringing whatever is at `point` to the middle of the frame.
 *
 * Only correct from rest, where the photo coordinate under a point is the point
 * itself — which is the only place a double tap can zoom in from.
 */
export function transformToCenter(point: Point, scale: number): Transform {
  return transformAround(point, { x: 0, y: 0 }, scale)
}

/** Where a pinch has got to, as a fraction of where it started. */
export function pinchScale(startDistance: number, currentDistance: number, startScale: number) {
  return clamp((currentDistance / Math.max(1, startDistance)) * startScale, MIN_SCALE, MAX_SCALE)
}

/**
 * Stops the photo being dragged away from the frame it is being viewed in.
 *
 * A photo smaller than the frame in either axis cannot move along it at all,
 * which is why the bound floors at zero rather than going negative.
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
 * How far the track should actually move for a drag of `dx`.
 *
 * Past the first or last photo it still gives, just reluctantly — an
 * unresponsive screen is indistinguishable from a broken one, whereas a page
 * that pulls back says "nothing over here" on its own.
 */
export function resistEdge(dx: number, index: number, count: number): number {
  const atFirst = index === 0 && dx > 0
  // `Math.max` for the reason `pageAfterSwipe` needs it: with no photos the last
  // index is -1, which no index equals, so the only page there is would be the
  // one page that pulled freely in both directions.
  const atLast = index === Math.max(0, count - 1) && dx < 0
  return atFirst || atLast ? dx * EDGE_RESISTANCE : dx
}

/**
 * The photo a swipe of `dx` lands on when released.
 *
 * `Math.max` around the last index because an empty set has no last index:
 * `count - 1` is -1, which is a *lower* bound than 0, and a clamp between 0 and
 * -1 returns -1 — a page off the front of the track, which the viewer would then
 * scroll to and never come back from.
 */
export function pageAfterSwipe(index: number, dx: number, frameWidth: number, count: number) {
  if (Math.abs(dx) <= frameWidth * PAGE_THRESHOLD) return index
  return clamp(index + (dx < 0 ? 1 : -1), 0, Math.max(0, count - 1))
}
