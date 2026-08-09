import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * True once `target` has scrolled up past a line `offset` below the top of the
 * viewport.
 *
 * Two screens ask slightly different questions of it. The sub-screen header
 * wants "has the large title gone behind the bar", where the line is the bar's
 * own height — measured rather than assumed, because it contains the top
 * safe-area inset, which is 0 on desktop and ~47px on a notched phone. The
 * wardrobe wants "is the control bar stuck to the top yet", where the line is
 * the viewport's own edge and the answer must not depend on how tall the bar
 * happens to be — it grows a row when filters are applied.
 *
 * An IntersectionObserver rather than a scroll listener. The question — "is this
 * element still below that line" — is exactly what the observer answers, and it
 * answers it off the main thread; the same check written as `onscroll` +
 * `getBoundingClientRect` forces a layout read on every frame of every scroll,
 * on a screen that is also decoding photographs.
 */
export function useScrolledPast(
  target: RefObject<HTMLElement | null>,
  /** An element whose height is the line, or that distance in pixels. */
  offset: RefObject<HTMLElement | null> | number,
): boolean {
  // `null` means "not measured yet", which is different from `0` — a zero
  // distance is a legitimate answer and must not hold the observer back.
  const [distance, setDistance] = useState<number | null>(
    typeof offset === 'number' ? offset : null,
  )
  const [past, setPast] = useState(false)

  useEffect(() => {
    if (typeof offset === 'number') {
      setDistance(offset)
      return
    }
    const node = offset.current
    if (!node) return
    // `offsetHeight`, not the entry's contentRect: the bar's padding is most of
    // its height, and the content box would put the trigger line inside it.
    const measure = () => setDistance(node.offsetHeight)
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    measure()
    return () => observer.disconnect()
  }, [offset])

  useEffect(() => {
    const node = target.current
    if (!node || distance === null) return
    const observer = new IntersectionObserver(
      ([entry]) => setPast(!entry.isIntersecting),
      { rootMargin: `-${distance}px 0px 0px 0px`, threshold: 0 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [target, distance])

  return past
}
