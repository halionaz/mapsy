import { useId, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react'
import { css } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { processPhoto, releasePreview, type ProcessedPhoto } from '@/shared/lib/image'
import { IconButton, Spinner } from '@/shared/ui/Button'
import { MAX_PHOTOS } from '../model/limits'

interface PhotoPickerProps {
  photos: ProcessedPhoto[]
  onChange: (photos: ProcessedPhoto[]) => void
}

/**
 * Photo selection, ordering and removal for the item form.
 *
 * Reordering is buttons rather than drag-and-drop: dragging inside a scrolling
 * form on a touch screen fights the scroll, and with at most five photos the
 * only move that matters is promoting one to the cover.
 */
export function PhotoPicker({ photos, onChange }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remaining = MAX_PHOTOS - photos.length

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
      const processed = results
        .filter((r): r is PromiseFulfilledResult<ProcessedPhoto> => r.status === 'fulfilled')
        .map((r) => r.value)
      const failed = results.length - processed.length

      if (processed.length > 0) onChange([...photos, ...processed])

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
    releasePreview(photos[index])
    onChange(photos.filter((_, i) => i !== index))
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= photos.length) return
    const next = [...photos]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
      <div className={hstack({ gap: '3', overflowX: 'auto', py: '1', alignItems: 'flex-start' })}>
        {photos.map((photo, index) => (
          <div key={photo.previewUrl} className={vstack({ gap: '1.5', flexShrink: 0 })}>
            <div className={css({ position: 'relative' })}>
              <img src={photo.previewUrl} alt={`사진 ${index + 1}`} className={thumb} />

              {/* The remove control sits on the photo rather than under it: it
                  is the one action whose target should be the thing it acts on,
                  and it keeps the row of reorder buttons down to two. */}
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

            <div className={hstack({ gap: '0.5', justify: 'center' })}>
              <IconButton
                label={`사진 ${index + 1} 앞으로`}
                size="sm"
                onClick={() => move(index, -1)}
                disabled={index === 0}
              >
                <ChevronLeft size={15} />
              </IconButton>
              <IconButton
                label={`사진 ${index + 1} 뒤로`}
                size="sm"
                onClick={() => move(index, 1)}
                disabled={index === photos.length - 1}
              >
                <ChevronRight size={15} />
              </IconButton>
            </div>
          </div>
        ))}

        {remaining > 0 && (
          <label htmlFor={inputId} className={addTile}>
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

      <input
        id={inputId}
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

const thumb = css({
  // Literal, not a shared constant: Panda extracts styles by reading the
  // source, and a value it has to resolve through a variable is a value it may
  // silently emit nothing for.
  width: '84px',
  height: '84px',
  objectFit: 'cover',
  rounded: 'card',
  bg: 'bg.subtle',
  display: 'block',
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
})

const addTile = css({
  // Same literal as `thumb`, for the same reason.
  width: '84px',
  height: '84px',
  flexShrink: 0,
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
