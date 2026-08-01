import { useId, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { processPhoto, releasePreview, type ProcessedPhoto } from '@/shared/lib/image'

/** Matches the 0–4 sort_order range the database enforces. */
export const MAX_PHOTOS = 5

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
      const skipped = fileList.length - accepted.length
      const processed = await Promise.all(accepted.map(processPhoto))
      onChange([...photos, ...processed])
      if (skipped > 0) setError(`사진은 최대 ${MAX_PHOTOS}장이라 ${skipped}장은 제외했어요.`)
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
      <div className={hstack({ gap: '2', overflowX: 'auto', py: '1' })}>
        {photos.map((photo, index) => (
          <div key={photo.previewUrl} className={vstack({ gap: '1', flexShrink: 0 })}>
            <div className={css({ position: 'relative' })}>
              <img
                src={photo.previewUrl}
                alt={`사진 ${index + 1}`}
                className={css({
                  width: '80px',
                  height: '80px',
                  objectFit: 'cover',
                  rounded: 'md',
                  bg: 'bg.subtle',
                })}
              />
              {index === 0 && (
                <span
                  className={css({
                    position: 'absolute',
                    bottom: '0',
                    insetInline: '0',
                    bg: 'accent',
                    color: 'accent.fg',
                    fontSize: '2xs',
                    textAlign: 'center',
                    py: '0.5',
                    roundedBottom: 'md',
                  })}
                >
                  대표
                </span>
              )}
            </div>
            <div className={hstack({ gap: '0.5', justify: 'center' })}>
              <IconButton label={`사진 ${index + 1} 앞으로`} onClick={() => move(index, -1)} disabled={index === 0}>
                ‹
              </IconButton>
              <IconButton label={`사진 ${index + 1} 삭제`} onClick={() => removeAt(index)}>
                ✕
              </IconButton>
              <IconButton
                label={`사진 ${index + 1} 뒤로`}
                onClick={() => move(index, 1)}
                disabled={index === photos.length - 1}
              >
                ›
              </IconButton>
            </div>
          </div>
        ))}

        {remaining > 0 && (
          <label
            htmlFor={inputId}
            className={css({
              width: '80px',
              height: '80px',
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              rounded: 'md',
              borderWidth: '1px',
              borderStyle: 'dashed',
              borderColor: 'border',
              color: 'fg.muted',
              fontSize: 'xs',
              cursor: 'pointer',
              _hover: { borderColor: 'fg.subtle' },
            })}
          >
            {busy ? '처리 중…' : `+ 사진\n${photos.length}/${MAX_PHOTOS}`}
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
        <p role="alert" className={css({ fontSize: 'xs', color: 'danger' })}>
          {error}
        </p>
      )}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={css({
        width: '22px',
        height: '22px',
        fontSize: 'xs',
        color: 'fg.muted',
        rounded: 'sm',
        cursor: 'pointer',
        _hover: { color: 'fg' },
        _disabled: { opacity: 0.3, cursor: 'not-allowed' },
        _focusVisible: {
          outline: '2px solid',
          outlineColor: 'accent',
          outlineOffset: '1px',
        },
      })}
    >
      {children}
    </button>
  )
}
