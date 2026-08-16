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
  /** Top-left of the grid in client coordinates. */
  left: number
  top: number
}

/** `null` when the grid cannot be measured, which is every environment without layout. */
export function readGridGeometry(element: HTMLElement): GridGeometry | null {
  const style = getComputedStyle(element)
  // The *used* track list — `repeat(auto-fill, 84px)` resolves to "84px 84px …",
  // so this is both the column count and the tile size.
  const tracks = style.gridTemplateColumns.split(' ').filter(Boolean)
  const tile = Number.parseFloat(tracks[0] ?? '')
  const gap = Number.parseFloat(style.columnGap)

  if (tracks.length === 0 || !Number.isFinite(tile) || !Number.isFinite(gap)) return null

  const rect = element.getBoundingClientRect()
  return { pitch: tile + gap, columns: tracks.length, left: rect.left, top: rect.top }
}

/** The slot under a point, clamped to the slots that hold a photo. */
export function slotAt(
  point: { x: number; y: number },
  grid: GridGeometry,
  count: number,
): number {
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
