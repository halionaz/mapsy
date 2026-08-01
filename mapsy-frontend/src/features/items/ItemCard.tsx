import { Link } from 'react-router'
import { css } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { ColorSwatch } from '@/shared/ui/ColorSwatch'
import type { WardrobeItem } from './api'
import type { PendingUpload } from './pendingUploads'

/**
 * Cards for the wardrobe grid.
 *
 * The photo carries the recognition, so a card is mostly image with the title
 * and colour dots as confirmation. Anything more competes with the grid's job of
 * showing a lot of clothes at once.
 *
 * Saved items and in-flight registrations are separate components because they
 * are separate things: one links to a detail screen that exists, the other is a
 * progress indicator that may need repairing.
 */

const frame = css({
  position: 'relative',
  aspectRatio: '1',
  rounded: 'lg',
  overflow: 'hidden',
  bg: 'bg.subtle',
})

const photo = css({ width: 'full', height: 'full', objectFit: 'cover' })

const title = css({
  fontSize: 'xs',
  fontWeight: 'medium',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export function ItemCard({ item }: { item: WardrobeItem }) {
  return (
    <Link
      to={`/items/${item.id}`}
      className={vstack({
        gap: '1.5',
        alignItems: 'stretch',
        rounded: 'lg',
        _focusVisible: {
          outline: '2px solid',
          outlineColor: 'accent',
          outlineOffset: '3px',
        },
      })}
    >
      <div className={frame}>
        {item.coverUrl ? (
          <img src={item.coverUrl} alt="" loading="lazy" className={photo} />
        ) : (
          <Placeholder>사진 없음</Placeholder>
        )}
        {item.isFavorite && (
          <span
            aria-label="즐겨찾기"
            className={css({
              position: 'absolute',
              top: '1.5',
              right: '1.5',
              fontSize: 'sm',
              // Sits on top of an arbitrary photo, so it needs its own contrast.
              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            })}
          >
            ★
          </span>
        )}
      </div>

      <p className={title}>{item.title}</p>

      {item.colors.length > 0 && (
        <div className={hstack({ gap: '1' })}>
          {item.colors.map((color) => (
            <ColorSwatch key={color} color={color} />
          ))}
        </div>
      )}
    </Link>
  )
}

interface PendingCardProps {
  pending: PendingUpload
  onRetry: (tempId: string) => void
  onDiscard: (tempId: string) => void
}

export function PendingCard({ pending, onRetry, onDiscard }: PendingCardProps) {
  const failed = pending.state === 'failed'
  const preview = pending.photos[0]?.previewUrl

  return (
    <div className={vstack({ gap: '1.5', alignItems: 'stretch' })}>
      <div className={frame}>
        {preview ? (
          // The locally generated thumbnail stands in until the row exists, so
          // the card is never a grey box.
          <img
            src={preview}
            alt=""
            className={css({
              width: 'full',
              height: 'full',
              objectFit: 'cover',
              opacity: failed ? 0.4 : 0.55,
            })}
          />
        ) : (
          <Placeholder>사진 없음</Placeholder>
        )}
        {!failed && (
          <span
            className={css({
              position: 'absolute',
              inset: '0',
              display: 'grid',
              placeItems: 'center',
              fontSize: 'xs',
              fontWeight: 'medium',
            })}
          >
            업로드 중…
          </span>
        )}
      </div>

      <p className={title}>{pending.draft.title}</p>

      {failed ? (
        <div className={vstack({ gap: '1', alignItems: 'stretch' })}>
          <p className={css({ fontSize: 'xs', color: 'danger' })}>업로드 실패</p>
          {pending.error && (
            <p className={css({ fontSize: '2xs', color: 'fg.muted', wordBreak: 'break-word' })}>
              {pending.error}
            </p>
          )}
          <div className={hstack({ gap: '2' })}>
            <TextButton onClick={() => onRetry(pending.tempId)} tone="accent">
              재시도
            </TextButton>
            <TextButton onClick={() => onDiscard(pending.tempId)} tone="muted">
              버리기
            </TextButton>
          </div>
        </div>
      ) : (
        <p className={css({ fontSize: 'xs', color: 'fg.muted' })}>저장 중</p>
      )}
    </div>
  )
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={css({
        width: 'full',
        height: 'full',
        display: 'grid',
        placeItems: 'center',
        color: 'fg.subtle',
        fontSize: 'xs',
      })}
    >
      {children}
    </div>
  )
}

function TextButton({
  onClick,
  tone,
  children,
}: {
  onClick: () => void
  tone: 'accent' | 'muted'
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={css({
        fontSize: 'xs',
        color: tone === 'accent' ? 'accent' : 'fg.muted',
        textDecoration: 'underline',
        cursor: 'pointer',
        rounded: 'sm',
        _focusVisible: {
          outline: '2px solid',
          outlineColor: 'accent',
          outlineOffset: '2px',
        },
      })}
    >
      {children}
    </button>
  )
}
