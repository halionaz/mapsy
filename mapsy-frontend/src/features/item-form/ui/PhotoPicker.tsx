import { useId, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { css } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

import { photoEntryKey, type PhotoEntry } from '@/entities/item'
import { processPhoto, releasePreview } from '@/shared/lib/image'
import { IconButton, Spinner } from '@/shared/ui/Button'
import { SquarePhoto, type PhotoFallback } from '@/shared/ui/SquarePhoto'
import { moveItem } from '../lib/photoGrid'
import { MAX_PHOTOS } from '../model/limits'
import { useDragReorder } from '../model/useDragReorder'

interface PhotoPickerProps {
  photos: PhotoEntry[]
  onChange: (photos: PhotoEntry[]) => void
  /**
   * Signed thumbnail URLs for the photos the item already has, by image id:
   * absent while one is still being signed, `null` when it could not be.
   *
   * Registration has none of these and does not pass it. Editing gets them from
   * the screen rather than signing here, because that screen has already asked
   * for the same photos to draw them elsewhere.
   */
  storedUrls?: ReadonlyMap<string, string | null>
}

/**
 * Photo selection, ordering and removal for the item form.
 *
 * The photos are a wrapping grid rather than a scrolling row, and reordering is
 * press-and-hold-then-drag. Both follow from the same thing: with at most five
 * photos everything fits on one screen, and a strip that scrolls sideways would
 * put a second competing gesture inside the one place a drag has to work.
 * `useDragReorder` holds the interaction; `photoGrid` holds its arithmetic.
 *
 * A tile is a tile whether its photo is already in storage or was picked a
 * second ago — the list is one ordered thing, and which half of it is which only
 * becomes a distinction when the form is saved.
 */
export function PhotoPicker({ photos, onChange, storedUrls }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const uid = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remaining = MAX_PHOTOS - photos.length
  const drag = useDragReorder({
    count: photos.length,
    onMove: (from, to) => onChange(moveItem(photos, from, to)),
  })

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setError(null)
    setBusy(true)
    try {
      const accepted = [...fileList].slice(0, remaining)
      const overflow = fileList.length - accepted.length

      // allSettled, not all: one undecodable file used to discard every photo
      // picked alongside it — and the successful ones had already allocated
      // preview object URLs that nobody then revoked.
      const results = await Promise.allSettled(accepted.map(processPhoto))
      const picked = results.flatMap((result): PhotoEntry[] =>
        result.status === 'fulfilled' ? [{ kind: 'picked', photo: result.value }] : [],
      )
      const failed = results.length - picked.length

      if (picked.length > 0) onChange([...photos, ...picked])

      const notes: string[] = []
      if (overflow > 0) notes.push(`사진은 최대 ${MAX_PHOTOS}장이라 ${overflow}장은 제외했어요.`)
      if (failed > 0) notes.push(`${failed}장은 불러오지 못했어요.`)
      setError(notes.length > 0 ? notes.join(' ') : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진을 불러오지 못했어요.')
    } finally {
      setBusy(false)
      // Clearing lets the same file be picked again after a removal; otherwise
      // the input reports no change and nothing happens.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeAt(index: number) {
    const entry = photos[index]
    // Only a picked photo owns an object URL. A stored one is dropped from the
    // list here and deleted for real when the form is saved.
    if (entry.kind === 'picked') releasePreview(entry.photo)
    onChange(photos.filter((_, i) => i !== index))
  }

  return (
    <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
      <div ref={drag.gridRef} className={grid} data-rearranging={drag.rearranging || undefined}>
        {photos.map((entry, index) => {
          const thumb = thumbOf(entry, storedUrls)
          const held = drag.heldIndex === index
          const offset = drag.offsetOf(index)

          return (
            <div
              key={photoEntryKey(entry)}
              className={tile}
              data-held={held || undefined}
              style={{
                transform: `translate3d(${offset.x}px, ${offset.y}px, 0)${held ? ' scale(1.06)' : ''}`,
                // The tile under the finger has to track it exactly; anything
                // else here reads as lag. Inline so it beats the class rule
                // rather than racing it on specificity.
                transition: held && drag.following ? 'none' : undefined,
                zIndex: held ? 1 : undefined,
              }}
            >
              <button
                type="button"
                className={grip}
                aria-label={`사진 ${index + 1}${thumb.missing ? ', 불러오지 못함' : ''}`}
                aria-describedby={`${uid}-help`}
                {...drag.tileProps(index)}
              >
                {/* Named by the button, so the photo itself is decorative. */}
                <SquarePhoto src={thumb.src} alt="" fallback={thumb.fallback} />
              </button>

              {/* The remove control sits on the photo rather than under it: it is
                  the one action whose target should be the thing it acts on. A
                  sibling of the tile button rather than a child, because a button
                  inside a button is neither valid nor reachable. */}
              <IconButton
                label={`사진 ${index + 1} 삭제`}
                size="sm"
                onPhoto
                onClick={() => removeAt(index)}
                className={removeButton}
              >
                <X size={13} />
              </IconButton>

              {index === 0 && <span className={coverTag}>대표</span>}
            </div>
          )
        })}

        {remaining > 0 && (
          <label htmlFor={`${uid}-file`} className={addTile}>
            {busy ? (
              <Spinner size={18} />
            ) : (
              <>
                <ImagePlus size={20} aria-hidden="true" />
                <span>
                  {photos.length}/{MAX_PHOTOS}
                </span>
              </>
            )}
          </label>
        )}
      </div>

      <p id={`${uid}-help`} className={css({ srOnly: true })}>
        스페이스를 눌러 사진을 집고, 왼쪽·오른쪽 방향키로 옮긴 뒤, 다시 스페이스를 눌러 놓아요.
      </p>
      <p role="status" aria-live="polite" className={css({ srOnly: true })}>
        {drag.announcement}
      </p>

      <input
        id={`${uid}-file`}
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={busy || remaining <= 0}
        onChange={(e) => void handleFiles(e.target.files)}
        className={css({ srOnly: true })}
      />

      {error && (
        <p role="alert" className={css({ textStyle: 'caption', color: 'danger' })}>
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * What the tile draws for one entry.
 *
 * A picked photo is its own preview and is always there. A stored one is a
 * signed URL that may still be coming or may never arrive, which is exactly the
 * distinction `SquarePhoto` already draws — so this translates into its
 * vocabulary rather than inventing a second one.
 */
function thumbOf(
  entry: PhotoEntry,
  storedUrls: ReadonlyMap<string, string | null> | undefined,
): { src: string | null; fallback: PhotoFallback; missing: boolean } {
  if (entry.kind === 'picked') {
    return { src: entry.photo.previewUrl, fallback: 'pending', missing: false }
  }

  const url = storedUrls?.get(entry.image.id)
  if (url === undefined) return { src: null, fallback: 'pending', missing: false }
  return { src: url, fallback: 'failed', missing: url === null }
}

const grid = css({
  display: 'grid',
  // Literal, not a shared constant: Panda extracts styles by reading the source,
  // and a value it has to resolve through a variable is a value it may silently
  // emit nothing for. `useDragReorder` reads the used track size back off the
  // computed style rather than keeping a second copy of it.
  gridTemplateColumns: 'repeat(auto-fill, 84px)',
  gap: '3',
  justifyContent: 'start',
})

const tile = css({
  width: '84px',
  position: 'relative',
  rounded: 'card',
  /**
   * Only while a rearrange is in progress.
   *
   * Outside one, a transform has to clear instantaneously: the list has just
   * been rewritten underneath and every tile is already sitting where its
   * transform was carrying it, so animating the transform away would show it
   * sliding back from a position it already left.
   */
  '[data-rearranging] &': {
    transitionProperty: 'transform',
    transitionDuration: 'normal',
    transitionTimingFunction: 'out',
    _motionReduce: { transitionDuration: '1ms' },
  },
  '&[data-held]': { shadow: 'raised' },
})

const grip = css({
  display: 'block',
  width: 'full',
  rounded: 'card',
  cursor: 'grab',
  // Keeps panning available — the hold is what decides between scrolling and
  // rearranging — while dropping the browser's 300ms double-tap wait, which
  // would otherwise sit on top of a 220ms hold.
  touchAction: 'manipulation',
  layerStyle: 'focusable',
  '&[aria-pressed=true]': { cursor: 'grabbing' },
})

const removeButton = css({
  position: 'absolute',
  top: '1',
  right: '1',
})

const coverTag = css({
  position: 'absolute',
  bottom: '1',
  left: '1',
  px: '1.5',
  py: '0.5',
  rounded: 'full',
  bg: 'accent',
  color: 'accent.fg',
  fontSize: '2xs',
  fontWeight: 'bold',
  lineHeight: 'tight',
  // The badge belongs to the photo under it, not to the finger dragging it.
  pointerEvents: 'none',
})

const addTile = css({
  // Same literal as `tile`, for the same reason.
  width: '84px',
  height: '84px',
  display: 'grid',
  placeItems: 'center',
  gap: '1',
  gridAutoFlow: 'row',
  rounded: 'card',
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: 'border.strong',
  bg: 'bg.subtle',
  color: 'fg.muted',
  textStyle: 'caption',
  cursor: 'pointer',
  transitionProperty: 'border-color, color, background-color',
  transitionDuration: 'fast',
  _hover: { borderColor: 'accent', color: 'accent.text' },
})
