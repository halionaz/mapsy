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
   * Signed URLs for the photos the item already has, by image id: absent while
   * one is still being signed, `null` when it could not be.
   *
   * Registration has none of these and does not pass it. Editing gets them from
   * the screen rather than signing here — and what that screen has to hand is
   * the *full-size* originals it already signed for the detail view, not
   * thumbnails. See `ItemEditPage` for why that trade is the cheap one.
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

  /**
   * The list as it is *now*, for the two paths that answer late.
   *
   * `handleFiles` returns after a decode and an encode — hundreds of
   * milliseconds — and the drop below commits on a timer. Both used to close
   * over the list from the render that started them, so a photo removed while
   * one was in flight came back when it landed. Its preview URL had already been
   * revoked by then, so what came back was a tile pointing at nothing.
   */
  const photosRef = useRef(photos)
  photosRef.current = photos

  const drag = useDragReorder({
    count: photos.length,
    onMove: (from, to) => onChange(moveItem(photosRef.current, from, to)),
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

      if (picked.length > 0) onChange([...photosRef.current, ...picked])

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
    // A rearrange still on its way down holds positions in the list that is
    // about to lose an entry, and its pending commit would put the removed photo
    // back. Removing wins: a rearrange can be repeated, a photo that reappears
    // with its preview already revoked cannot be explained.
    drag.abandon()

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
          const missing = thumb.src === null && thumb.fallback === 'failed'

          return (
            <div
              key={photoEntryKey(entry)}
              className={tile}
              data-held={held || undefined}
              // The tile under the finger tracks it exactly, so its transition
              // is off while that lasts. Said as an attribute rather than as an
              // inline style — see `tile`.
              data-following={(held && drag.following) || undefined}
              style={{
                transform: `translate3d(${offset.x}px, ${offset.y}px, 0)${held ? ' scale(1.06)' : ''}`,
                zIndex: held ? 1 : undefined,
              }}
            >
              <button
                type="button"
                className={grip}
                aria-label={`사진 ${index + 1}${missing ? ', 불러오지 못함' : ''}`}
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

              {/* Follows where the tile is drawn, not where the list still says
                  it is. Dragging a photo to the front is the way the cover
                  changes, so a badge that waits for the drop leaves it on the
                  tile being pushed aside for the whole gesture. */}
              {drag.slotOf(index) === 0 && <span className={coverTag}>대표</span>}
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

      {/* Every tile points at this one sentence, so a screen reader repeats it
          per tile — which is the cost of describing the operation where it is
          performed. Kept to one short clause for that reason. */}
      <p id={`${uid}-help`} className={css({ srOnly: true })}>
        스페이스로 집고, 방향키로 옮기고, 스페이스로 놓아요.
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
): { src: string | null; fallback: PhotoFallback } {
  if (entry.kind === 'picked') return { src: entry.photo.previewUrl, fallback: 'pending' }

  const url = storedUrls?.get(entry.image.id)
  if (url === undefined) return { src: null, fallback: 'pending' }
  return { src: url, fallback: 'failed' }
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
  // The lift's shadow eases out on its own after the drop, when the transform
  // rule below is no longer in force. It does not ease *in* — picking a tile up
  // should feel like it happened, not like it is happening.
  transitionProperty: 'box-shadow',
  transitionDuration: 'normal',
  transitionTimingFunction: 'out',
  /**
   * Only while a rearrange is in progress, and it replaces the rule above rather
   * than joining it.
   *
   * Outside a rearrange the transform has to clear instantaneously: the list has
   * just been rewritten underneath and every tile is already sitting where its
   * transform was carrying it, so animating the transform away would show it
   * sliding back from a position it had already reached.
   */
  '[data-rearranging] &': {
    transitionProperty: 'transform',
    transitionDuration: 'normal',
    transitionTimingFunction: 'out',
    _motionReduce: { transitionDuration: '1ms' },
    /**
     * The tile under the finger, which must not animate at all — it is being
     * placed a frame at a time, and a transition on top of that reads as lag.
     *
     * A rule rather than an inline style, and that is the whole point of the
     * attribute it hangs off. The drop reads this element's computed
     * `transition-duration` to size its wait, so anything the component writes
     * onto the element it also reads from can answer its own question. Written
     * inline as the `transition` shorthand it did exactly that: a shorthand
     * resets the longhands it omits, so the duration read back was 0s and every
     * drop animation was cut on its first frame.
     *
     * Nested rather than spelled out as one selector because it has to win on
     * specificity rather than on source order — `.tile[data-following]` inside
     * `[data-rearranging]` is (0,3,0) against the (0,2,0) around it — and Panda
     * only types a selector that starts or ends with `&`.
     */
    '&[data-following]': { transitionProperty: 'none' },
  },
  _motionReduce: { transitionDuration: '1ms' },
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
