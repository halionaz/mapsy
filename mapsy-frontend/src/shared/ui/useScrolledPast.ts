import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * True once `target` has scrolled up past a line below the top of the viewport.
 *
 * Two screens ask slightly different questions of it. The sub-screen header
 * wants "has the large title gone behind the bar", where the line is the bar's
 * own height — passed as `below`, and measured rather than assumed because it
 * contains the top safe-area inset, which is 0 on desktop and ~47px on a notched
 * phone. The wardrobe wants "is the control bar stuck yet", where the line is
 * where that bar comes to rest — `top: var(--safe-t)` — so it passes the fixed
 * strip that covers exactly that inset and puts a zero-height sentinel where the
 * bar's top edge sits. Reading the line off the strip rather than off the bar
 * itself is what keeps the answer independent of the bar's height, which grows a
 * row when filters are applied.
 *
 * An IntersectionObserver rather than a scroll listener. The question — "is this
 * element still below that line" — is exactly what the observer answers, and it
 * answers it off the main thread; the same check written as `onscroll` +
 * `getBoundingClientRect` forces a layout read on every frame of every scroll,
 * on a screen that is also decoding photographs.
 */
export function useScrolledPast(
  target: RefObject<HTMLElement | null>,
  /** An element whose height is the line. Omitted, the line is the viewport top. */
  below?: RefObject<HTMLElement | null>,
): boolean {
  // `null` means "waiting for a measurement", which only happens when `below`
  // was given. Without it the line is 0 and the observer can start immediately.
  const [distance, setDistance] = useState<number | null>(below ? null : 0)
  const [past, setPast] = useState(false)

  useEffect(() => {
    const node = below?.current
    if (!node) return
    // `offsetHeight`, not the entry's contentRect: the bar's padding is most of
    // its height, and the content box would put the trigger line inside it.
    const measure = () => setDistance(node.offsetHeight)
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    measure()
    return () => observer.disconnect()
  }, [below])

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
