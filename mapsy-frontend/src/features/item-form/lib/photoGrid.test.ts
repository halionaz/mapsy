/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'

import {
  displaySlot,
  moveItem,
  readTransitionMs,
  slotAt,
  slotOffset,
  type GridGeometry,
} from './photoGrid'

/**
 * The arithmetic a drag is made of.
 *
 * None of it can be checked by looking at the screen it produces — a tile one
 * slot out looks exactly like a tile in the right place until you compare it
 * with where the finger is. So the rules are held down here, and the component
 * above only has to place what these return.
 */

// Three columns of 84px tiles with a 12px gap, starting at the origin.
const grid: GridGeometry = { pitch: 96, columns: 3, left: 0, top: 0 }

describe('displaySlot', () => {
  it('opens a gap at the target and shifts everything passed over', () => {
    // 0 dragged onto 2: the two it crossed each step back one.
    expect([0, 1, 2, 3].map((i) => displaySlot(i, 0, 2))).toEqual([2, 0, 1, 3])
  })

  it('shifts the other way when the photo moves toward the cover', () => {
    expect([0, 1, 2, 3].map((i) => displaySlot(i, 3, 1))).toEqual([0, 2, 3, 1])
  })

  it('leaves everything alone while the photo is over its own slot', () => {
    expect([0, 1, 2, 3].map((i) => displaySlot(i, 2, 2))).toEqual([0, 1, 2, 3])
  })
})

describe('slotOffset', () => {
  it('measures across a row', () => {
    expect(slotOffset(0, 2, grid)).toEqual({ x: 192, y: 0 })
  })

  it('measures down a column, and back along the row', () => {
    // Slot 0 is the first of row 1; slot 4 is the second of row 2.
    expect(slotOffset(0, 4, grid)).toEqual({ x: 96, y: 96 })
  })

  it('stays still when nothing can be measured', () => {
    // Every environment without layout — the tiles simply do not animate.
    expect(slotOffset(0, 4, null)).toEqual({ x: 0, y: 0 })
  })
})

describe('slotAt', () => {
  it('answers with the slot the point is inside', () => {
    expect(slotAt({ x: 100, y: 10 }, grid, 5)).toBe(1)
    expect(slotAt({ x: 20, y: 100 }, grid, 5)).toBe(3)
  })

  it('never lands past the last photo, however far the finger goes', () => {
    // The row's empty tail and the add tile are not slots a photo can occupy.
    expect(slotAt({ x: 280, y: 100 }, grid, 5)).toBe(4)
    expect(slotAt({ x: 900, y: 900 }, grid, 5)).toBe(4)
  })

  it('never lands before the cover either', () => {
    expect(slotAt({ x: -400, y: -400 }, grid, 5)).toBe(0)
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
   * Both spellings, because production only ever sends one of them and it is not
   * the one the config file shows. `panda.config.ts` authors `200ms`; the built
   * stylesheet emits `.2s` (checked in `dist`). With only the `ms` case covered,
   * dropping the seconds branch — which reads like dead code next to the config
   * — would make every drop commit in 0.2ms and every tile jump, with the whole
   * suite still green.
   */
  it('reads milliseconds', () => {
    expect(readTransitionMs(tile('200ms'))).toBe(200)
  })

  it('reads the seconds the stylesheet actually ships', () => {
    expect(readTransitionMs(tile('.2s'))).toBe(200)
  })

  it('answers zero for a tile with nothing to wait for', () => {
    // No stylesheet, no transition, nothing to outlast — which is a real answer
    // and not a failure: the drop can rewrite the list immediately.
    expect(readTransitionMs(document.createElement('div'))).toBe(0)
  })
})

describe('moveItem', () => {
  it('lifts one out and puts it back down at the target', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('leaves the list alone when it lands where it started', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })
})
