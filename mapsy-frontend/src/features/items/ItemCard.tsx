import { Link } from 'react-router'
import { css, cx } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { ColorSwatch } from '@/shared/ui/ColorSwatch'
import { skeletonSurface } from '@/shared/ui/skeletonStyle'
import { SquarePhoto } from '@/shared/ui/SquarePhoto'
import type { WardrobeItem } from './api'
import type { PendingUpload } from './pendingUploads'

/**
 * Cards for the wardrobe grid.
 *
 * The photo carries the recognition, so a card is mostly image with the title
 * and colour dots as confirmation. Anything more competes with the grid's job of
 * showing a lot of clothes at once.
 *
 * Every card occupies the same box no matter how much of the item was filled in.
 * Only the title and the photo are guaranteed to exist, so the parts that render
 * optional data reserve their space instead of collapsing — otherwise an item
 * saved without colours is a visibly shorter card sitting next to one that has
 * them, and the grid reads as broken rather than as sparsely filled data.
 *
 * Saved items and in-flight registrations are separate components because they
 * are separate things: one links to a detail screen that exists, the other is a
 * progress indicator that may need repairing.
 */

const title = css({
  fontSize: 'xs',
  fontWeight: 'medium',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

/**
 * The line under the title: colour dots on an item card, upload state on a
 * pending one. Fixed height so it takes up the same room when it is empty —
 * that is what keeps a colourless item the same size as a colourful one.
 */
const metaRow = css({
  display: 'flex',
  alignItems: 'center',
  gap: '1',
  // One line of `xs` text at the inherited line-height, so the row is the same
  // height whether it holds colour dots, "저장 중", or nothing at all.
  height: '4.5',
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
      {/* alt is empty on purpose: the title is the next line, and announcing it
          twice is noise rather than description. */}
      <SquarePhoto
        src={item.coverUrl}
        alt=""
        // `coverUrl` is null for two unrelated reasons — the item has no photo,
        // or it has one whose thumbnail could not be signed — and the query
        // hands both back the same way. The image rows are what tell them
        // apart, and without asking, a garment with a photo would be labelled
        // as having none.
        fallback={item.images.length > 0 ? 'failed' : 'empty'}
      >
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
      </SquarePhoto>

      <p className={title}>{item.title}</p>

      <div className={metaRow}>
        {item.colors.map((color) => (
          <ColorSwatch key={color} color={color} />
        ))}
      </div>
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
      {/* The locally generated thumbnail stands in until the row exists, so the
          card is never a grey box. */}
      <SquarePhoto src={preview ?? null} alt="" fallback="empty">
        {!failed && (
          <span
            className={css({
              position: 'absolute',
              inset: '0',
              display: 'grid',
              placeItems: 'center',
              // The scrim, not a lowered opacity on the photo: it reads the
              // same over a dark garment as over a white one.
              bg: 'overlay.scrim',
              color: 'overlay.fg',
              fontSize: 'xs',
              fontWeight: 'medium',
            })}
          >
            업로드 중…
          </span>
        )}
      </SquarePhoto>

      <p className={title}>{pending.draft.title}</p>

      {/* Same reserved line the item card uses, so a card that is still
          uploading lines up with the saved ones around it. */}
      <div className={metaRow}>
        {failed ? (
          <span className={css({ fontSize: 'xs', color: 'danger' })}>업로드 실패</span>
        ) : (
          <span className={css({ fontSize: 'xs', color: 'fg.muted' })}>저장 중</span>
        )}
      </div>

      {/* A failed card is deliberately the one card that grows: it is asking to
          be repaired, and the reason and the two actions have to be reachable. */}
      {failed && (
        <div className={vstack({ gap: '1', alignItems: 'stretch' })}>
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
      )}
    </div>
  )
}

/**
 * A card with nothing in it yet, for the first load of the wardrobe.
 *
 * Same three parts in the same places as a real card, so the grid does not
 * re-lay-out when the data lands — the placeholders are simply replaced by what
 * they were standing in for.
 */
export function CardSkeleton() {
  return (
    <div className={vstack({ gap: '1.5', alignItems: 'stretch' })} aria-hidden="true">
      <SquarePhoto src={null} alt="" />
      {/* The bar is the height of the text it replaces, inside a box the height
          of the line — so nothing moves when the real title arrives. */}
      <div className={css({ height: '4.5', display: 'flex', alignItems: 'center' })}>
        <div className={cx(skeletonSurface, css({ height: '2.5', width: '4/5', rounded: 'sm' }))} />
      </div>
      <div className={metaRow} />
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
