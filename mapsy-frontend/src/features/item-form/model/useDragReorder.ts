import { useEffect, useRef, useState } from 'react'

import { clamp } from '@/shared/lib/clamp'
import {
  readGridGeometry,
  readTransitionMs,
  slotAt,
  slotOffset,
  displaySlot,
  type GridGeometry,
} from '../lib/photoGrid'

/**
 * Press-and-hold to pick a tile up, drag it, let go.
 *
 * **Why a hold rather than an immediate drag.** The picker sits inside a form
 * that scrolls, and a touch that starts on a tile has to be able to mean either
 * thing. The browser decides which at the first movement, so the only way to
 * have both is to let the finger declare itself: stay still and it is a
 * rearrange, move and it is a scroll. That is also what the phone does on its
 * own home screen, so it needs no explaining.
 *
 * A mouse has no such ambiguity — the page scrolls by wheel — so there the drag
 * starts on the first few pixels of movement instead of on a timer.
 *
 * **Why the page stops scrolling only after the lift.** `touch-action` is read
 * when the gesture begins, so it cannot be switched on part-way; the way to keep
 * scrolling available until the tile lifts and not after is `preventDefault` on
 * touchmove from that moment. React's own touch listeners are passive at the
 * root and cannot do it, hence the native listener below.
 *
 * Keyboards get the same operation without the pointer: space picks up, the
 * arrows move, space drops, escape puts it back. Dragging is the reason the
 * old 앞으로/뒤로 buttons are gone, and it must not be the reason the picker
 * became unusable without a touchscreen.
 */

/** Long enough not to fire while a finger is on its way past, short enough to feel like a lift. */
const HOLD_MS = 220
/** Movement within the hold that means the finger came to scroll. */
const HOLD_SLOP_PX = 8
/** Movement that starts a mouse drag. */
const MOUSE_SLOP_PX = 4

interface Held {
  /** Where the photo sits in the committed list. */
  from: number
  /** Where it would land if it were let go now. */
  to: number
  /** Offset from its own slot while a pointer drags it; `null` while it animates to a slot. */
  follow: { x: number; y: number } | null
  /** Picked up by keyboard, which is the only way a hold can outlive the focus that made it. */
  keyboard: boolean
}

/**
 * Where a pointer is, in both coordinate systems.
 *
 * A drag asks two different questions of the same movement and they do not take
 * the same answer, which is a distinction this file has now got wrong once in
 * each direction. So the names carry the space:
 *
 * **Page** — for the tile's offset and for which slot is under the pointer. The
 * grid is measured in page coordinates because a mouse drag can scroll the page
 * under it (the wheel is never blocked, only touch panning is), and a tile
 * positioned from client deltas drifts away from the cursor by however far the
 * page moved while the drop still lands where the cursor is.
 *
 * **Client** — for the hold's slop, which asks whether the *finger moved on the
 * glass*. A pan scrolls the page under the finger at 1:1, so page-space movement
 * during a scroll is ~0: measured there, a scroll is indistinguishable from
 * holding still, and holding still is what lifts a tile.
 */
function pointerPoint(event: React.PointerEvent<HTMLElement>) {
  return {
    clientX: event.clientX,
    clientY: event.clientY,
    pageX: event.clientX + window.scrollX,
    pageY: event.clientY + window.scrollY,
  }
}

type PointerPoint = ReturnType<typeof pointerPoint>

interface Gesture {
  pointerId: number
  index: number
  element: HTMLElement
  /** Where it went down, in both spaces — see `pointerPoint`. */
  start: PointerPoint
  holdTimer: number | null
  lifted: boolean
  /** The authority on where it would land — pointerup can arrive before a re-render. */
  to: number
}

export interface DragReorder {
  gridRef: React.RefObject<HTMLDivElement | null>
  /** Set on the grid while a rearrange is in progress; the tiles' transition hangs off it. */
  rearranging: boolean
  tileProps: (index: number) => {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
    onBlur: () => void
    'aria-pressed': boolean
  }
  /** Where the tile at `index` is drawn relative to its own slot. */
  offsetOf: (index: number) => { x: number; y: number }
  /** The tile being held, by its index in the committed list. */
  heldIndex: number | null
  /** True while a finger or mouse is dragging it, which is when it must not animate. */
  following: boolean
  /** The slot the tile at `index` is drawn in — where it *looks* like it is. */
  slotOf: (index: number) => number
  /**
   * Drops a rearrange on the floor, mid-drag or mid-settle.
   *
   * For a caller that is about to change the list underneath one: the held
   * numbers are positions in a list that is about to stop existing, and the
   * pending commit would put a photo back that was just removed.
   */
  abandon: () => void
  /** For the live region — what just happened, in a sentence. */
  announcement: string
}

export function useDragReorder({
  count,
  onMove,
}: {
  count: number
  onMove: (from: number, to: number) => void
}): DragReorder {
  const gridRef = useRef<HTMLDivElement>(null)
  const geometry = useRef<GridGeometry | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const settleTimer = useRef<number | null>(null)
  const unblockScroll = useRef<(() => void) | null>(null)
  const [held, setHeld] = useState<Held | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(
    () => () => {
      if (gesture.current?.holdTimer != null) clearTimeout(gesture.current.holdTimer)
      if (settleTimer.current != null) clearTimeout(settleTimer.current)
      unblockScroll.current?.()
    },
    [],
  )

  /** A short tap where the phone supports it. Silently absent on iOS. */
  function tick(pattern: number) {
    navigator.vibrate?.(pattern)
  }

  function measure() {
    const grid = gridRef.current
    geometry.current = grid ? readGridGeometry(grid) : null
  }

  /**
   * Stops the page scrolling under the tile that just lifted.
   *
   * Attached here rather than from an effect, and that is the whole point:
   * an effect runs a frame after the state that triggers it, and the first
   * touchmove of the drag can land in that gap. One unprevented touchmove is
   * enough — the browser starts scrolling, and every touchmove after it arrives
   * `cancelable: false`, so the page and the tile then move together for the
   * rest of the gesture.
   */
  function blockScroll() {
    const grid = gridRef.current
    if (!grid) return
    const hold = (event: TouchEvent) => event.preventDefault()
    grid.addEventListener('touchmove', hold, { passive: false })
    unblockScroll.current = () => grid.removeEventListener('touchmove', hold)
  }

  function lift(current: Gesture) {
    current.lifted = true
    current.holdTimer = null
    measure()
    blockScroll()
    // So a finger that wanders off the tile — which is the entire point — keeps
    // reporting to it.
    current.element.setPointerCapture?.(current.pointerId)
    tick(8)
    setHeld({ from: current.index, to: current.index, follow: { x: 0, y: 0 }, keyboard: false })
    setAnnouncement(`${current.index + 1}번째 사진을 집었어요.`)
  }

  function forget() {
    const current = gesture.current
    if (current?.holdTimer != null) clearTimeout(current.holdTimer)
    gesture.current = null
    unblockScroll.current?.()
    unblockScroll.current = null
  }

  function commit(from: number, to: number) {
    setHeld(null)
    if (from !== to) onMove(from, to)
  }

  function abandon() {
    if (settleTimer.current != null) clearTimeout(settleTimer.current)
    settleTimer.current = null
    forget()
    setHeld(null)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>, index: number) {
    if (held || gesture.current) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const current: Gesture = {
      pointerId: event.pointerId,
      index,
      element: event.currentTarget,
      start: pointerPoint(event),
      holdTimer: null,
      lifted: false,
      to: index,
    }
    gesture.current = current

    // A mouse waits for movement instead: there is nothing for a hold to
    // disambiguate, and a delay before the cursor picks something up feels broken.
    if (event.pointerType !== 'mouse') {
      current.holdTimer = window.setTimeout(() => {
        if (gesture.current === current) lift(current)
      }, HOLD_MS)
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return

    const point = pointerPoint(event)

    if (!current.lifted) {
      // On the glass: did the finger itself move? A page that scrolled out from
      // under it does not count, and in page space that is all a scroll looks
      // like.
      const travelled = Math.hypot(
        point.clientX - current.start.clientX,
        point.clientY - current.start.clientY,
      )
      if (event.pointerType === 'mouse') {
        if (travelled > MOUSE_SLOP_PX) lift(current)
      } else if (travelled > HOLD_SLOP_PX) {
        // The finger came to scroll. Nothing has been prevented yet, so the
        // browser is free to carry on with it.
        forget()
      }
      return
    }

    // In the document, from here down: both the tile's offset and the slot under
    // the pointer are answers about where things sit on the page.
    const follow = {
      x: point.pageX - current.start.pageX,
      y: point.pageY - current.start.pageY,
    }
    const grid = geometry.current
    const to = grid ? slotAt({ x: point.pageX, y: point.pageY }, grid, count) : current.index
    if (to !== current.to) tick(4)
    current.to = to
    setHeld({ from: current.index, to, follow, keyboard: false })
  }

  function handlePointerUp(event: React.PointerEvent<HTMLElement>) {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return
    if (!current.lifted) {
      forget()
      return
    }

    const { index: from, to } = current
    const tile = current.element.parentElement
    forget()

    /**
     * Read here rather than at lift, and from the tile rather than from the
     * token.
     *
     * Here, because the transition to wait for is the one `[data-rearranging]`
     * turns on, and that attribute only exists while something is held — at lift
     * the tile still answers with the base rule's duration, which today happens
     * to be the same number and would stop being one the day the shadow and the
     * movement want different speeds.
     *
     * From the tile, because that is what makes `prefers-reduced-motion` answer
     * for itself: the token says 200ms to someone whose tiles move in one.
     */
    const settle = tile ? readTransitionMs(tile) : 0

    // Dropping the offset lets the tile animate into its slot; the list is
    // rewritten once it gets there, which is why nothing visibly jumps at the
    // moment the DOM order changes.
    setHeld({ from, to, follow: null, keyboard: false })
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null
      commit(from, to)
      setAnnouncement(`${to + 1}번째에 놓았어요.`)
    }, settle)
  }

  /**
   * Something took the pointer away — the system, or a gesture the browser
   * decided was its own after all. Puts the photo back rather than committing:
   * an interrupted drag is not an instruction, and the one place this is
   * reachable is the one place we cannot know what the user meant.
   */
  function handlePointerCancel(event: React.PointerEvent<HTMLElement>) {
    const current = gesture.current
    if (!current || event.pointerId !== current.pointerId) return
    const lifted = current.lifted
    forget()
    if (!lifted) return
    setHeld(null)
    setAnnouncement('제자리에 놓았어요.')
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>, index: number) {
    // A pointer is already holding something, or the keys belong to another tile.
    if (held && (!held.keyboard || held.from !== index)) return

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (!held) {
        measure()
        setHeld({ from: index, to: index, follow: null, keyboard: true })
        setAnnouncement(`${index + 1}번째 사진을 집었어요. 방향키로 옮기고 다시 스페이스를 눌러요.`)
        return
      }
      commit(held.from, held.to)
      setAnnouncement(`${held.to + 1}번째에 놓았어요.`)
      return
    }

    if (!held) return

    if (event.key === 'Escape') {
      event.preventDefault()
      setHeld(null)
      setAnnouncement('제자리에 놓았어요.')
      return
    }

    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (step === 0) return
    event.preventDefault()

    const to = clamp(held.to + step, 0, count - 1)
    if (to === held.to) return
    setHeld({ ...held, to })
    setAnnouncement(`${to + 1}번째로 옮겼어요.`)
  }

  /** Where the tile at `index` is drawn — the one rule both the badge and the offset read. */
  function slotOf(index: number): number {
    return held ? displaySlot(index, held.from, held.to) : index
  }

  return {
    gridRef,
    rearranging: held !== null,
    heldIndex: held?.from ?? null,
    following: held?.follow != null,
    slotOf,
    abandon,
    announcement,
    tileProps: (index) => ({
      onPointerDown: (event) => handlePointerDown(event, index),
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onKeyDown: (event) => handleKeyDown(event, index),
      // A keyboard hold lives on the focused tile; losing focus with it still up
      // would leave the grid held open with no way to put it down.
      onBlur: () => {
        if (held?.keyboard && held.from === index) {
          setHeld(null)
          setAnnouncement('제자리에 놓았어요.')
        }
      },
      'aria-pressed': held?.from === index,
    }),
    offsetOf: (index) => {
      if (!held) return { x: 0, y: 0 }
      if (index === held.from && held.follow) return held.follow
      return slotOffset(index, slotOf(index), geometry.current)
    },
  }
}
