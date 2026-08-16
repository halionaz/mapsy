/**
 * Where each photo is drawn while the grid is being rearranged.
 *
 * All of it is arithmetic on slot numbers rather than measurement. The tiles are
 * a uniform grid, so "which slot is under the finger" and "how far has this tile
 * been pushed" are both answerable from one pitch and one column count — and the
 * alternative, reading `getBoundingClientRect` per tile per pointermove, reads
 * layout in the middle of a gesture that is also writing transforms, which is
 * the shape that produces a stutter you cannot debug from the code.
 *
 * The geometry is *measured once* per drag and from the computed style, not
 * copied from the stylesheet. Panda owns the tile size and the gap; a second
 * copy of 84 in here is the thing that goes quietly wrong the day the tile
 * changes size.
 */

import { clamp } from '@/shared/lib/clamp'

export interface GridGeometry {
  /** Distance between neighbouring slots — one tile plus one gap. */
  pitch: number
  columns: number
  /**
   * Top-left of the grid in **page** coordinates.
   *
   * Not viewport coordinates: this is measured once when the tile lifts, and a
   * mouse drag can scroll the page under it — the wheel is never blocked, only
   * touch panning is. Held in page space, the measurement survives that.
   */
  left: number
  top: number
}

/** `null` when the grid cannot be measured, which is every environment without layout. */
export function readGridGeometry(element: HTMLElement): GridGeometry | null {
  const style = getComputedStyle(element)
  // The *used* track list — `repeat(auto-fill, 84px)` resolves to "84px 84px …",
  // so this is both the column count and the tile size. An element with no
  // layout answers `none` or an empty string, and both fall out as NaN below.
  const tracks = style.gridTemplateColumns.split(' ').filter(Boolean)
  const tile = Number.parseFloat(tracks[0] ?? '')
  // The longhand, while the stylesheet writes the `gap` shorthand. A browser
  // resolves one into the other; jsdom does not expand shorthands at all, which
  // is why the test beside this plants `column-gap` directly and so never walks
  // that half. Safe as long as nothing sets the grid's gap inline — nothing
  // does, and the tile above is the standing reminder of what happens when a
  // component writes to an element something else reads computed values from.
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
 * How long this tile takes to move, in milliseconds.
 *
 * The drop commits on a timer, and the timer has to outlast the transition or
 * the transform is cleared mid-flight and the tile jumps. Reading it back off
 * the element is the same refusal as the pitch above — the stylesheet owns the
 * number — and it is read from the *element* rather than from the
 * `--durations-normal` token so that `prefers-reduced-motion` is included:
 * under that setting the tiles move in 1ms, and a settle still waiting 200ms
 * would be a fifth of a second in which the drop appears to have done nothing.
 *
 * Both unit spellings are handled, and only one of them is the browser's.
 * Measured in Chrome against these rules: a duration authored as `200ms` reads
 * back `0.2s`, and `1ms` under `prefers-reduced-motion` reads back `0.001s` —
 * computed times come back in seconds whatever the stylesheet said. `200ms` is
 * what **jsdom** returns, because it hands the inline value back unnormalised
 * (measured there too). So the `ms` branch is for the tests that stand on it;
 * the seconds branch is the one production takes, and deleting it because the
 * token reads `200ms` would make every drop commit in a fifth of a millisecond.
 *
 * Zero is an answer rather than a failure: a tile with no transition has nothing
 * to wait for, and committing immediately is what that means. Nothing to read at
 * all says the same thing — there is no stylesheet, so there is no animation to
 * outlast.
 */
export function readTransitionMs(element: HTMLElement): number {
  const raw = getComputedStyle(element).transitionDuration.trim()
  const amount = Number.parseFloat(raw)
  if (!Number.isFinite(amount)) return 0
  return raw.endsWith('ms') ? amount : amount * 1000
}

/** The slot under a point — in page coordinates, like the grid — clamped to the slots that hold a photo. */
export function slotAt(point: { x: number; y: number }, grid: GridGeometry, count: number): number {
  const column = clamp(Math.floor((point.x - grid.left) / grid.pitch), 0, grid.columns - 1)
  const row = Math.max(0, Math.floor((point.y - grid.top) / grid.pitch))
  return clamp(row * grid.columns + column, 0, count - 1)
}

/** How far slot `to` sits from slot `from`. */
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
 * Which slot the photo at `index` is drawn in while the one from `from` hovers
 * over `to`.
 *
 * Everything between the two ends shifts by one, in the direction that opens a
 * gap at `to`. Nothing outside that range moves — which is why dragging across a
 * five-photo row only ever animates the photos actually passed over.
 */
export function displaySlot(index: number, from: number, to: number): number {
  if (index === from) return to
  if (from < to) return index > from && index <= to ? index - 1 : index
  return index >= to && index < from ? index + 1 : index
}

/** The list with one item lifted out and put back down at `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
