import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * True once `target` has scrolled up behind `header`.
 *
 * Drives the large-title collapse: a screen shows its name once, big, at the top
 * of the content, and the sticky bar only starts carrying that name after the
 * big one has gone. Two copies of the title on screen at once is the thing this
 * exists to avoid.
 *
 * An IntersectionObserver rather than a scroll listener. The question — "is this
 * element still below that line" — is exactly what the observer answers, and it
 * answers it off the main thread; the same check written as `onscroll` +
 * `getBoundingClientRect` forces a layout read on every frame of every scroll,
 * on a screen that is also decoding photographs.
 *
 * The header's height is measured rather than assumed because it contains the
 * top safe-area inset, which is 0 on desktop and ~47px on a notched phone.
 */
export function useScrolledPast(
  target: RefObject<HTMLElement | null>,
  header: RefObject<HTMLElement | null>,
): boolean {
  const [headerHeight, setHeaderHeight] = useState(0)
  const [past, setPast] = useState(false)

  useEffect(() => {
    const node = header.current
    if (!node) return
    // `offsetHeight`, not the entry's contentRect: the bar's padding is most of
    // its height, and the content box would put the trigger line inside it.
    const observer = new ResizeObserver(() => setHeaderHeight(node.offsetHeight))
    observer.observe(node)
    setHeaderHeight(node.offsetHeight)
    return () => observer.disconnect()
  }, [header])

  useEffect(() => {
    const node = target.current
    if (!node || headerHeight === 0) return
    const observer = new IntersectionObserver(
      ([entry]) => setPast(!entry.isIntersecting),
      { rootMargin: `-${headerHeight}px 0px 0px 0px`, threshold: 0 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [target, headerHeight])

  return past
}
