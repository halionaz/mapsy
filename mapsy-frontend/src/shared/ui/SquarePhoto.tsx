import { useCallback, useEffect, useRef, useState } from 'react'
import { css, cva, cx } from 'styled-system/css'

import { skeletonSurface } from './skeletonStyle'

/**
 * A photo in a 1:1 box that never changes size.
 *
 * The box is square by declaration rather than sized from the image, because a
 * URL is signed asynchronously and then has to decode — so between mount and
 * paint there is a stretch where the app knows a photo exists and has nothing to
 * draw. Sizing from the image collapses the box during that stretch and pushes
 * everything below it around as each photo arrives.
 *
 * What goes inside is one of four things: a pulsing skeleton (a photo is
 * coming), a labelled placeholder (there is no photo), a failure notice (one was
 * coming and did not arrive), or the photo faded in over the skeleton.
 *
 * `fit` is the part worth reading before reusing this. Only the *thumbnails* are
 * square — `processPhoto` centre-crops those on upload — while the full-size
 * originals keep their own proportions. So a thumbnail can fill the box
 * (`cover`, and the crop is a no-op because it already happened), and a
 * full-size photo has to be fitted into it (`contain`), or the square would eat
 * the top and bottom of every tall garment.
 */

/**
 * What an absent `src` means. The component cannot tell these apart on its own —
 * all three are `null` from here — so the caller says which.
 */
export type PhotoFallback =
  /** A photo is coming; keep the skeleton up. */
  | 'pending'
  /** There is no photo to wait for. */
  | 'empty'
  /** There was one and it did not arrive. */
  | 'failed'

interface SquarePhotoProps {
  /** `null` while the URL is still being signed, or when there is no photo. */
  src: string | null
  alt: string
  /** What `src == null` means here. */
  fallback?: PhotoFallback
  /** `cover` for pre-cropped thumbnails, `contain` for full-size originals. */
  fit?: 'cover' | 'contain'
  /** `eager` for a photo that is already on screen, e.g. the first tile. */
  loading?: 'eager' | 'lazy'
  /**
   * The photo was there and would not load.
   *
   * Reported rather than only drawn, because a caller that thinks the photo is
   * fine will keep offering it: a tile that says 불러오지 못함 and still opens a
   * full-screen viewer onto the same broken URL is a worse failure than the one
   * this component was catching.
   */
  onLoadError?: () => void
  /** Overlays drawn on top of the photo: the favourite star, an upload scrim. */
  children?: React.ReactNode
}

// Owned here so that a photo which failed to load and a photo whose URL never
// arrived cannot drift into saying different things to the same user.
const FALLBACK_LABELS: Record<Exclude<PhotoFallback, 'pending'>, string> = {
  empty: '사진 없음',
  failed: '불러오지 못함',
}

// A span rather than a div: the detail screen wraps this in a <button>, whose
// content model is phrasing content.
const frame = css({
  display: 'block',
  position: 'relative',
  aspectRatio: '1',
  width: 'full',
  rounded: 'lg',
  overflow: 'hidden',
  bg: 'bg.subtle',
})

const skeleton = cx(skeletonSurface, css({ position: 'absolute', inset: '0' }))

const notice = css({
  position: 'absolute',
  inset: '0',
  display: 'grid',
  placeItems: 'center',
  px: '2',
  textAlign: 'center',
  color: 'fg.subtle',
  fontSize: 'xs',
})

const photo = cva({
  base: {
    position: 'absolute',
    inset: '0',
    width: 'full',
    height: 'full',
    transitionProperty: 'opacity',
    transitionDuration: 'fast',
  },
  variants: {
    // Fading in over the skeleton rather than replacing it avoids the flash of
    // background between the two.
    loaded: {
      true: { opacity: 1 },
      false: { opacity: 0 },
    },
    fit: {
      cover: { objectFit: 'cover' },
      contain: { objectFit: 'contain' },
    },
  },
})

/** Which URL settled, and how. Keyed by URL so a re-signed photo starts over. */
interface LoadState {
  src: string
  outcome: 'loaded' | 'failed'
}

export function SquarePhoto({
  src,
  alt,
  fallback = 'pending',
  fit = 'cover',
  loading = 'lazy',
  onLoadError,
  children,
}: SquarePhotoProps) {
  // Not a boolean: the detail screen re-signs its URLs, and a boolean would stay
  // true across the swap and show the new photo before it had decoded.
  const [state, setState] = useState<LoadState | null>(null)
  const outcome = src != null && state?.src === src ? state.outcome : null

  /**
   * Records an outcome, and does nothing at all if it is the one already
   * recorded.
   *
   * The bail-out is load-bearing rather than tidy. `checkComplete` re-runs every
   * time React re-attaches the ref, which is every render once anything in its
   * closure changes; storing a fresh object each time would be a new state value
   * each time, and a component that re-renders itself on every render.
   */
  const settle = useCallback((settledSrc: string, outcome: LoadState['outcome']) => {
    setState((previous) =>
      previous?.src === settledSrc && previous.outcome === outcome
        ? previous
        : { src: settledSrc, outcome },
    )
  }, [])

  /**
   * Read through a ref so that `fail` — and `checkComplete` below it — do not
   * depend on the caller's function identity.
   *
   * Every call site builds this inline, and the one that matters cannot do
   * otherwise: the detail screen renders a tile per photo inside a `map`, so
   * `onLoadError={() => markUnloadable(slot.id)}` is a new function on every
   * render and there is no `useCallback` available inside a loop. Depending on
   * it made `checkComplete` new every render, and React tears down and
   * re-attaches a callback ref whose identity changed — on a screen that
   * re-renders once per frame while the viewer is being swiped. Owning the
   * problem here fixes it for every caller instead of asking each one to.
   */
  const onLoadErrorRef = useRef(onLoadError)
  useEffect(() => {
    onLoadErrorRef.current = onLoadError
  })

  const fail = useCallback(
    (failedSrc: string) => {
      settle(failedSrc, 'failed')
      onLoadErrorRef.current?.()
    },
    [settle],
  )

  // A photo already in the browser cache can finish before React has attached
  // onLoad, which would leave the skeleton up for good. The ref runs once the
  // element exists, so `complete` is answerable. Memoised on `src` so it isn't
  // torn down and re-attached on every render.
  const checkComplete = useCallback(
    (node: HTMLImageElement | null) => {
      if (!node?.complete || src == null) return
      // `complete` is true for a broken image too, so it cannot stand on its own
      // — a cached failure would otherwise fade a broken-image icon in at full
      // opacity, which is the same failure looking completely different
      // depending on whether it happened to be cached.
      if (node.naturalWidth > 0) settle(src, 'loaded')
      else fail(src)
    },
    [src, settle, fail],
  )

  const failed = outcome === 'failed'
  const showing: PhotoFallback | null = failed ? 'failed' : src == null ? fallback : null
  const pending = showing === 'pending' || (src != null && outcome == null)

  return (
    <span className={frame}>
      {pending && <span className={skeleton} />}

      {showing != null && showing !== 'pending' && (
        <span className={notice}>{FALLBACK_LABELS[showing]}</span>
      )}

      {src != null && !failed && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          className={photo({ loaded: outcome === 'loaded', fit })}
          onLoad={() => settle(src, 'loaded')}
          // Signed URLs expire and networks drop; without this the skeleton
          // pulses for ever and a failure reads as a slow connection.
          onError={() => fail(src)}
          ref={checkComplete}
        />
      )}

      {children}
    </span>
  )
}
