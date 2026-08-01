import { Link } from 'react-router'
import { css } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { ColorSwatch } from '@/shared/ui/ColorSwatch'
import type { WardrobeEntry } from './queries'

/**
 * One garment in the wardrobe grid.
 *
 * The photo carries the recognition, so the card is mostly image with the title
 * and colour dots as confirmation. Anything more competes with the grid's job of
 * showing a lot of clothes at once.
 */

interface ItemCardProps {
  entry: WardrobeEntry
  onRetry: (tempId: string) => void
  onDiscard: (tempId: string) => void
}

export function ItemCard({ entry, onRetry, onDiscard }: ItemCardProps) {
  const uploading = entry.upload === 'uploading'
  const failed = entry.upload === 'failed'

  const thumbnail = (
    <div
      className={css({
        position: 'relative',
        aspectRatio: '1',
        rounded: 'lg',
        overflow: 'hidden',
        bg: 'bg.subtle',
      })}
    >
      {entry.coverUrl ? (
        <img
          src={entry.coverUrl}
          alt=""
          loading="lazy"
          className={css({
            width: 'full',
            height: 'full',
            objectFit: 'cover',
            opacity: uploading ? 0.55 : 1,
          })}
        />
      ) : (
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
          사진 없음
        </div>
      )}

      {entry.isFavorite && (
        <span
          aria-label="즐겨찾기"
          className={css({
            position: 'absolute',
            top: '1.5',
            right: '1.5',
            fontSize: 'sm',
            // The star sits on top of an arbitrary photo, so it needs its own
            // contrast rather than relying on the image behind it.
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          })}
        >
          ★
        </span>
      )}

      {uploading && (
        <span
          className={css({
            position: 'absolute',
            inset: '0',
            display: 'grid',
            placeItems: 'center',
            fontSize: 'xs',
            fontWeight: 'medium',
            color: 'fg',
          })}
        >
          업로드 중…
        </span>
      )}
    </div>
  )

  if (failed) {
    // Not a link: the item does not exist server-side, so navigating to it would
    // 404. The card becomes a repair affordance instead.
    return (
      <div className={vstack({ gap: '1.5', alignItems: 'stretch' })}>
        {thumbnail}
        <p className={css({ fontSize: 'xs', color: 'danger' })}>업로드 실패</p>
        <div className={hstack({ gap: '2' })}>
          <button
            type="button"
            onClick={() => onRetry(entry.id)}
            className={css({
              fontSize: 'xs',
              color: 'accent',
              textDecoration: 'underline',
              cursor: 'pointer',
            })}
          >
            재시도
          </button>
          <button
            type="button"
            onClick={() => onDiscard(entry.id)}
            className={css({
              fontSize: 'xs',
              color: 'fg.muted',
              textDecoration: 'underline',
              cursor: 'pointer',
            })}
          >
            버리기
          </button>
        </div>
      </div>
    )
  }

  const card = (
    <>
      {thumbnail}
      <p
        className={css({
          fontSize: 'xs',
          fontWeight: 'medium',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        })}
      >
        {entry.title}
      </p>
      {entry.colors.length > 0 && (
        <div className={hstack({ gap: '1' })}>
          {entry.colors.map((color) => (
            <ColorSwatch key={color} color={color} />
          ))}
        </div>
      )}
    </>
  )

  if (uploading) {
    return <div className={vstack({ gap: '1.5', alignItems: 'stretch' })}>{card}</div>
  }

  return (
    <Link
      to={`/items/${entry.id}`}
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
      {card}
    </Link>
  )
}
