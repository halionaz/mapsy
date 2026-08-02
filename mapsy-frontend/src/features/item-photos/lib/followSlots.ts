/**
 * Where the viewer should land when the collection changes under it.
 *
 * The viewer addresses pages by position, and a position stops meaning the same
 * thing the moment a photo is added or removed. Both ways that goes wrong are
 * decided here rather than in the component, because neither is visible from the
 * call site and neither needs a DOM to demonstrate:
 *
 * - A photo removed **after** the open page leaves the index past the end —
 *   a blank screen, a counter reading "5 / 4", and `slots[index]` undefined.
 * - A photo removed **before** it is worse, because nothing looks broken: the
 *   length shrinks, the index stays in range, and the same position quietly
 *   addresses the next photo along. `[A,B,C,D,E]` at index 2 is C; losing A
 *   makes index 2 D, with no swipe and no warning.
 *
 * Following the id closes both, and clamps only when the photo really is gone.
 */
export function indexAfterChange(
  slots: readonly { id: string }[],
  /** The photo on screen, by id. `null` before the viewer has seated. */
  shownId: string | null,
  currentIndex: number,
): number | null {
  // Nothing to land on. The viewer draws "사진이 없어요" and the index is moot;
  // moving it would only be an extra write to the track on every change.
  if (slots.length === 0) return null

  const at = slots.findIndex((slot) => slot.id === shownId)
  // Still there, possibly somewhere else — follow it. Gone — hold the position,
  // which is the neighbour that took its place, and clamp if it was the last.
  const target = at >= 0 ? at : Math.min(currentIndex, slots.length - 1)

  // `null` rather than the current index, so the caller cannot navigate to where
  // it already is: `goTo` writes the track and notifies the screen behind, and
  // this effect runs on every change to the collection — including the re-signs
  // that leave the photos themselves untouched.
  return target === currentIndex ? null : target
}
