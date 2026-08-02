import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from 'styled-system/css'

import { clamp } from '@/shared/lib/clamp'
import type { PhotoSlot } from '../lib/photoSlots'
import {
  DOUBLE_TAP_SCALE,
  IDENTITY,
  clampToBounds,
  distance,
  focusOf,
  isZoomed,
  midpoint,
  pageAfterSwipe,
  pinchScale,
  resistEdge,
  transformAround,
  transformToCenter,
  type Point,
  type Transform,
} from '../lib/photoTransform'

/**
 * Full-screen photo viewer: swipe between an item's photos, pinch or
 * double-tap to zoom, drag to pan.
 *
 * Every gesture is handled here rather than delegated to the browser, and that
 * is a deliberate trade. The cheap version pages with CSS scroll-snap and lets
 * `touch-action` hand pinches to the browser — but the browser only pinch-zooms
 * the visual viewport, so the chrome zooms along with the photo, and a
 * two-finger gesture inside a horizontal scroller gets claimed as a scroll
 * (which then fires pointercancel and kills the pinch half the time). Owning
 * the surface with `touch-action: none` means paging, zooming and panning are
 * decided by one piece of code that knows which is which.
 *
 * The trade-off is that snapping has to be written out, and that a flick has no
 * momentum past it — a swipe lands on the next photo or springs back, and never
 * carries through two.
 *
 * The geometry lives in `photoTransform.ts`, which is where it can be tested.
 *
 * Rendered as a native <dialog> so Esc, focus trapping and inertness of the
 * page behind it are the platform's problem rather than ours.
 */

interface PhotoViewerProps {
  /**
   * Every photo the item has, in order, each carrying whether it is here yet.
   *
   * Slots rather than a list of URLs. A bare `string[]` cannot say why it is
   * short: a photo still being signed and a photo that failed both come through
   * as absent, and the viewer drew the difference it could not see — announcing
   * a failure for the length of every signing round trip. That distinction is
   * the whole point of `photoSlots`, and flattening it at this boundary threw it
   * away one function call after it was made. It also left the viewer unable to
   * page to a photo it could not show, so a failure found in here could not be
   * reported to the tile that offered it.
   */
  slots: PhotoSlot[]
  /** Which photo to open on; the first one if it is not among the slots. */
  startId: string | null
  /** Item title — used for the accessible name and each photo's alt text. */
  title: string
  /**
   * Which photo is on screen now. The strip behind the viewer follows it, so
   * that closing leaves the screen showing the photo the user was looking at
   * rather than the one they opened — which is the whole distance they swiped,
   * silently undone.
   */
  onPageChange?: (slot: PhotoSlot) => void
  /**
   * A photo would not load in here. Required, not optional: for every photo but
   * the first this is the first attempt anywhere — the tiles behind are lazy —
   * so a viewer that kept the discovery to itself would leave the tile offering
   * a photo that is known not to arrive.
   */
  onLoadError: (id: string) => void
  onClose: () => void
}

const DOUBLE_TAP_MS = 300
/** A press that moves less than this is a tap, not a drag. */
const TAP_SLOP_PX = 12
/** Two taps further apart than this are two taps, not a double tap. */
const DOUBLE_TAP_SLOP_PX = 40
const SNAP_TRANSITION = 'transform 240ms cubic-bezier(0.22, 0.61, 0.36, 1)'

/**
 * What a page says when it has no photograph on it.
 *
 * Positioned over the page rather than laid out beside the photo, so that it
 * covers the whole page whatever is or is not in it — and so that nothing moves
 * at the moment the photo appears underneath it.
 */
const pageNotice = css({
  position: 'absolute',
  inset: '0',
  display: 'grid',
  placeItems: 'center',
  px: '6',
  textAlign: 'center',
  fontSize: 'sm',
  color: 'overlay.fg',
  opacity: 0.7,
})

/**
 * What to say over a page, or `null` when the photograph speaks for itself.
 *
 * "Signed" and "arrived" are two different things, so a `ready` slot is still a
 * wait until its pixels are here — which is why this asks about the URL and not
 * only about the slot.
 */
function pageMessage(slot: PhotoSlot, decoded: ReadonlySet<string>): string | null {
  if (slot.state === 'failed') return '사진을 불러오지 못했어요'
  if (slot.state === 'ready') return decoded.has(slot.url) ? null : '사진을 불러오는 중…'
  return '사진을 불러오는 중…'
}

type Gesture =
  /** One finger, photo at rest — dragging the track sideways. */
  | { kind: 'swipe'; startX: number; dx: number }
  /** One finger, photo zoomed in — dragging the photo inside the frame. */
  | { kind: 'pan'; startX: number; startY: number; lastX: number; lastY: number }
  /** Two fingers — scaling around the point held between them. */
  | { kind: 'pinch'; startDistance: number; startScale: number; focus: Point }

export function PhotoViewer({
  slots,
  startId,
  title,
  onPageChange,
  onLoadError,
  onClose,
}: PhotoViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const imageRefs = useRef<(HTMLImageElement | null)[]>([])

  // Worked out once and used by both the initial state and the seating effect
  // below, which would otherwise be the same expression written twice and
  // liable to be changed once.
  const startIndex = Math.max(
    0,
    slots.findIndex((slot) => slot.id === startId),
  )

  // Seated from the start, not left at zero for the effect below to correct.
  // The window around the current page is what decides which photos are
  // fetched, so an index that is briefly wrong is a fetch for the wrong photo,
  // and the one the user asked for starts a render late.
  const [index, setIndex] = useState(startIndex)

  /**
   * Photos that have actually arrived, by URL.
   *
   * `ready` means a URL was signed, which is not the same as pixels having been
   * fetched and decoded — and between the two the `<img>` has no intrinsic size,
   * so the page is the viewer's own near-black background with a counter on it.
   * That is the state `SquarePhoto` keeps a skeleton up for; the viewer was
   * telling the user about failures and saying nothing about waiting.
   *
   * By URL rather than by photo id, because re-signing gives the same photo a
   * new URL that has to be fetched again — an id would report the new URL as
   * already arrived and hand back the blank page this exists to prevent.
   */
  const [decoded, setDecoded] = useState<ReadonlySet<string>>(() => new Set())

  function markDecoded(url: string) {
    setDecoded((seen) => (seen.has(url) ? seen : new Set(seen).add(url)))
  }

  // Gesture state lives in refs, not state: a pinch produces a pointermove per
  // frame per finger, and re-rendering the tree on each one to move a transform
  // that React does not otherwise care about is how a viewer ends up stuttering.
  // `index` is the exception — the counter is rendered from it.
  const indexRef = useRef(index)

  // Read through a ref so that `goTo` does not have to list it as a dependency:
  // the callers pass an inline closure, so a new identity arrives every render,
  // and goTo would be rebuilt — along with the key handler bound to it — on each
  // one, which is a memo that only looks like a memo.
  const pageChangeRef = useRef(onPageChange)
  useEffect(() => {
    pageChangeRef.current = onPageChange
  })
  const transform = useRef<Transform>(IDENTITY)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef({ time: 0, x: 0, y: 0 })

  const applyTrack = useCallback((page: number, dx: number, animate: boolean) => {
    const track = trackRef.current
    if (!track) return
    track.style.transition = animate ? SNAP_TRANSITION : 'none'
    // Percentages resolve against the track's own width, which is one photo
    // wide, so -100% is exactly one page.
    track.style.transform = `translate3d(calc(${-page * 100}% + ${dx}px), 0, 0)`
  }, [])

  const applyPhoto = useCallback((animate: boolean) => {
    const image = imageRefs.current[indexRef.current]
    if (!image) return
    const { scale, x, y } = transform.current
    image.style.transition = animate ? SNAP_TRANSITION : 'none'
    image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`
  }, [])

  const resetZoom = useCallback(
    (animate: boolean) => {
      transform.current = IDENTITY
      applyPhoto(animate)
    },
    [applyPhoto],
  )

  const goTo = useCallback(
    (next: number, animate = true) => {
      // `Math.max` for the same reason `pageAfterSwipe` needs it: with no photos
      // the last index is -1, and clamping between 0 and -1 yields -1.
      const target = clamp(next, 0, Math.max(0, slots.length - 1))
      // Reset before the index moves, so it is the photo being left behind that
      // goes back to fit — arriving on a page still zoomed from last time reads
      // as a bug.
      if (target !== indexRef.current) resetZoom(false)
      indexRef.current = target
      setIndex(target)
      const shown = slots[target]
      if (shown) pageChangeRef.current?.(shown)
      applyTrack(target, 0, animate)
    },
    [slots, applyTrack, resetZoom],
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()

    // <dialog> makes the page inert but not unscrollable: on iOS the wardrobe
    // behind the viewer still rubber-bands under a pan that overshoots.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // Puts the track under the page `index` already names — the initial state is
  // the right page, but the transform that shows it is a DOM write, and this is
  // where DOM writes happen.
  //
  // Through `goTo` rather than by hand, so that the strip behind is told where
  // the viewer ended up. The restore path is exactly the one where the two would
  // otherwise start out disagreeing.
  //
  // An empty `slots` here means an item with no photos at all, not one whose
  // photos are unknown: the screen around this only renders once the item is
  // loaded, and every photo is a slot from the first render whether or not its
  // URL has been signed.
  const seated = useRef(false)
  useEffect(() => {
    if (seated.current || slots.length === 0) return
    seated.current = true
    goTo(startIndex, false)
  }, [slots.length, startIndex, goTo])

  // A re-sign hands the current page a new URL, and with it a new <img> element
  // carrying no transform — while `transform.current` still describes the one
  // that went away. Left alone the viewer believes it is zoomed in when the
  // photo on screen is not: one-finger drags route to panning, so swiping stops
  // working, and the next thing to touch the transform snaps the photo up to a
  // magnification the user did not ask for.
  const currentUrl = slots[index]?.url ?? null
  useEffect(() => {
    resetZoom(false)
  }, [currentUrl, resetZoom])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') goTo(indexRef.current + 1)
      else if (event.key === 'ArrowLeft') goTo(indexRef.current - 1)
      else return
      event.preventDefault()
    }
    dialog.addEventListener('keydown', handleKeyDown)
    return () => dialog.removeEventListener('keydown', handleKeyDown)
  }, [goTo])

  /** Applies the frame's measurements to the bounds check. */
  function settle(next: Transform): Transform {
    const image = imageRefs.current[indexRef.current]
    const stage = stageRef.current
    if (!image || !stage) return next
    // offsetWidth is the laid-out size, unaffected by the transform, so it stays
    // correct however deep into a pinch we are.
    return clampToBounds(
      next,
      { width: image.offsetWidth, height: image.offsetHeight },
      { width: stage.clientWidth, height: stage.clientHeight },
    )
  }

  /** Pointer position relative to the middle of the stage, which is where the
   * photo's transform-origin sits. */
  function toStageCenter(point: Point): Point {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: point.x - (rect.left + rect.width / 2), y: point.y - (rect.top + rect.height / 2) }
  }

  /** The two live pointers, or undefined if a pinch has stopped being one. */
  function fingerPair(): [Point, Point] | undefined {
    const [a, b] = [...pointers.current.values()]
    return a && b ? [a, b] : undefined
  }

  function beginPinch() {
    const pair = fingerPair()
    if (!pair) return
    // Two fingers rarely land in the same frame, so the first one has usually
    // already dragged the track a few pixels as a swipe. Nothing downstream of
    // here touches the track again — the gesture is about the photo now — so
    // without this the page stays sitting off-centre until the next swipe
    // recomputes it, which is most visible while panning a zoomed photo.
    applyTrack(indexRef.current, 0, true)

    const mid = toStageCenter(midpoint(...pair))
    gesture.current = {
      kind: 'pinch',
      startDistance: distance(...pair),
      startScale: transform.current.scale,
      focus: focusOf(mid, transform.current),
    }
  }

  function handlePointerDown(event: React.PointerEvent) {
    stageRef.current?.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.current.size >= 2) {
      beginPinch()
    } else {
      gesture.current = isZoomed(transform.current)
        ? {
            kind: 'pan',
            startX: event.clientX,
            startY: event.clientY,
            lastX: event.clientX,
            lastY: event.clientY,
          }
        : { kind: 'swipe', startX: event.clientX, dx: 0 }
    }
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const current = gesture.current
    if (!current) return

    if (current.kind === 'pinch') {
      const pair = fingerPair()
      if (!pair) return
      const mid = toStageCenter(midpoint(...pair))
      const scale = pinchScale(current.startDistance, distance(...pair), current.startScale)
      transform.current = settle(transformAround(current.focus, mid, scale))
      applyPhoto(false)
      return
    }

    if (current.kind === 'pan') {
      transform.current = settle({
        ...transform.current,
        x: transform.current.x + (event.clientX - current.lastX),
        y: transform.current.y + (event.clientY - current.lastY),
      })
      current.lastX = event.clientX
      current.lastY = event.clientY
      applyPhoto(false)
      return
    }

    current.dx = resistEdge(event.clientX - current.startX, indexRef.current, slots.length)
    applyTrack(indexRef.current, current.dx, false)
  }

  function handleTap(event: React.PointerEvent) {
    const previous = lastTap.current
    const isDouble =
      event.timeStamp - previous.time < DOUBLE_TAP_MS &&
      distance({ x: event.clientX, y: event.clientY }, previous) < DOUBLE_TAP_SLOP_PX

    if (!isDouble) {
      lastTap.current = { time: event.timeStamp, x: event.clientX, y: event.clientY }
      return
    }
    // Cleared so a third tap starts over rather than reading as another double.
    lastTap.current = { time: 0, x: 0, y: 0 }

    if (isZoomed(transform.current)) {
      resetZoom(true)
      return
    }
    const tapped = toStageCenter({ x: event.clientX, y: event.clientY })
    transform.current = settle(transformToCenter(tapped, DOUBLE_TAP_SCALE))
    applyPhoto(true)
  }

  function handlePointerUp(event: React.PointerEvent) {
    const finished = gesture.current
    pointers.current.delete(event.pointerId)
    if (stageRef.current?.hasPointerCapture(event.pointerId)) {
      stageRef.current.releasePointerCapture(event.pointerId)
    }

    if (finished?.kind === 'pinch') {
      const remaining = [...pointers.current.values()][0]
      // Lifting one finger mid-pinch continues as a pan rather than ending the
      // gesture, which is what the hand that is still on the screen expects.
      gesture.current = remaining
        ? {
            kind: 'pan',
            startX: remaining.x,
            startY: remaining.y,
            lastX: remaining.x,
            lastY: remaining.y,
          }
        : null
      if (!remaining && !isZoomed(transform.current)) resetZoom(true)
      return
    }

    if (pointers.current.size > 0) return
    gesture.current = null

    if (finished?.kind === 'pan') {
      if (!isZoomed(transform.current)) {
        resetZoom(true)
        return
      }
      // A press that went nowhere while zoomed in is a tap, and the second one
      // is how you get back out — without this, double-tap only ever zooms in.
      const travelled = distance(
        { x: event.clientX, y: event.clientY },
        { x: finished.startX, y: finished.startY },
      )
      if (travelled <= TAP_SLOP_PX) handleTap(event)
      return
    }

    if (finished?.kind !== 'swipe') return

    const width = stageRef.current?.clientWidth ?? 1
    const landing = pageAfterSwipe(indexRef.current, finished.dx, width, slots.length)
    if (landing !== indexRef.current) {
      goTo(landing)
      return
    }
    applyTrack(indexRef.current, 0, true)
    if (Math.abs(finished.dx) <= TAP_SLOP_PX) handleTap(event)
  }

  function handlePointerCancel(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size > 0) return
    gesture.current = null
    applyTrack(indexRef.current, 0, true)
    if (!isZoomed(transform.current)) resetZoom(true)
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={`${title} 사진`}
      className={css({
        position: 'fixed',
        inset: '0',
        width: '100dvw',
        maxWidth: '100dvw',
        height: '100dvh',
        maxHeight: '100dvh',
        m: '0',
        p: '0',
        border: 'none',
        overflow: 'hidden',
        bg: 'overlay',
        color: 'overlay.fg',
        '&::backdrop': { background: '{colors.overlay}' },
      })}
    >
      <div
        ref={stageRef}
        // Every gesture is ours; leaving any default action to the browser is
        // what makes a pinch turn into a page scroll halfway through.
        className={css({
          position: 'absolute',
          inset: '0',
          overflow: 'hidden',
          touchAction: 'none',
          userSelect: 'none',
        })}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          ref={trackRef}
          className={css({
            display: 'flex',
            width: 'full',
            height: 'full',
            willChange: 'transform',
          })}
        >
          {slots.map((slot, position) => {
            const message = pageMessage(slot, decoded)
            return (
              <div
                key={slot.id}
                className={css({
                  position: 'relative',
                  flex: '0 0 100%',
                  height: 'full',
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                })}
              >
                {/* Only the page in view and its two neighbours are fetched. The
                    track moves by transform, so every slide is inside the viewport
                    as far as the browser is concerned and `loading="lazy"` would
                    fetch the lot — which would undo the detail screen's lazy tiles
                    the instant the viewer opened. One page either side is enough
                    that a swipe lands on a photo that is already there. */}
                {Math.abs(position - index) <= 1 && (
                  <>
                    {slot.state === 'ready' && (
                      <img
                        ref={(node) => {
                          imageRefs.current[position] = node
                          // A photo already in the cache can finish before React
                          // attaches onLoad — the same race `SquarePhoto` keeps a
                          // ref check for — and without this the page would stay
                          // covered by a notice about a wait that already ended.
                          if (node?.complete && node.naturalWidth > 0) markDecoded(slot.url)
                        }}
                        src={slot.url}
                        alt={`${title} 사진 ${position + 1}`}
                        // Otherwise a mouse drag starts a native image drag and
                        // the swipe dies on the first pointermove.
                        draggable={false}
                        onLoad={() => markDecoded(slot.url)}
                        onError={() => onLoadError(slot.id)}
                        className={css({
                          display: 'block',
                          maxWidth: 'full',
                          maxHeight: 'full',
                          objectFit: 'contain',
                          transformOrigin: 'center',
                          willChange: 'transform',
                        })}
                      />
                    )}
  
                    {/* A page with nothing on it yet says which nothing it is.
                        Words rather than a skeleton: a pale pulsing block is what
                        a photo looks like against a page, and this is a room with
                        the lights off. */}
                    {message != null && <p className={pageNotice}>{message}</p>}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Outside the track, which is a flex row with no position of its own —
            in there this centred-by-absolute notice would sit in the top-left
            corner under the close button. The stage is the positioned box. */}
        {slots.length === 0 && <p className={pageNotice}>사진이 없어요</p>}
      </div>

      <div
        className={css({
          position: 'absolute',
          insetInline: '0',
          top: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '2',
          px: '2',
          pt: 'calc({spacing.2} + var(--safe-t))',
          pb: '2',
          // Sits over the photo, so it carries its own darkening rather than
          // hoping the top of the picture is dark enough to read against.
          bgGradient: 'to-b',
          gradientFrom: '{colors.overlay.scrim}',
          gradientTo: 'transparent',
          // The bar spans the full width over the top of the photo. Left
          // clickable it would swallow every swipe and pinch that started in
          // that band, so only the button in it takes pointers.
          pointerEvents: 'none',
        })}
      >
        <button
          type="button"
          aria-label="사진 닫기"
          onClick={() => dialogRef.current?.close()}
          className={css({
            fontSize: 'xl',
            lineHeight: '1',
            color: 'overlay.fg',
            px: '3',
            py: '2',
            rounded: 'md',
            cursor: 'pointer',
            pointerEvents: 'auto',
            _focusVisible: { outline: '2px solid', outlineColor: 'overlay.fg', outlineOffset: '0' },
          })}
        >
          ✕
        </button>

        {slots.length > 1 && (
          <span
            aria-live="polite"
            className={css({ fontSize: 'sm', color: 'overlay.fg', px: '3', py: '2' })}
          >
            {index + 1} / {slots.length}
          </span>
        )}
      </div>
    </dialog>
  )
}
