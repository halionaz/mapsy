import { Star } from 'lucide-react'
import { Link } from 'react-router'
import { css, cx } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

import { Button, Spinner } from '@/shared/ui/Button'
import { ColorSwatch } from '@/shared/ui/ColorSwatch'
import { skeletonSurface } from '@/shared/ui/skeletonStyle'
import { SquarePhoto } from '@/shared/ui/SquarePhoto'
import type { WardrobeItem } from '../model/types'
import type { PendingUpload } from '../model/pendingUploads'

/**
 * Cards for the wardrobe grid.
 *
 * The photo carries the recognition, so a card is mostly image with the title
 * and colour dots as confirmation. Anything more competes with the grid's job of
 * showing a lot of clothes at once — which is also why the tile has no card
 * surface of its own: three columns of bordered boxes on a phone leaves the
 * photographs about 90px wide, and the chrome ends up louder than the clothes.
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
  textStyle: 'caption',
  color: 'fg',
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
  // One line of caption text at the inherited line-height, so the row is the
  // same height whether it holds colour dots, "저장 중", or nothing at all.
  height: '4.5',
})

const tile = cx(
  vstack({ gap: '2', alignItems: 'stretch' }),
  css({
    rounded: 'card',
    transitionProperty: 'transform',
    transitionDuration: 'fast',
    transitionTimingFunction: 'out',
    layerStyle: 'focusable',
    // Hover-capable pointers only. On a touch screen `:hover` sticks after a tap
    // and leaves the tapped tile floating a couple of pixels above its row.
    '@media (hover: hover)': {
      _hover: { transform: 'translateY(-3px)' },
    },
    _motionReduce: {
      '@media (hover: hover)': { _hover: { transform: 'none' } },
    },
  }),
)

export function ItemCard({ item }: { item: WardrobeItem }) {
  return (
    <Link to={`/items/${item.id}`} className={tile}>
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
          <span aria-label="즐겨찾기" className={favoriteBadge}>
            <Star size={11} fill="currentColor" strokeWidth={0} />
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

/**
 * The star, over an arbitrary photograph.
 *
 * A tinted disc rather than a bare glyph with a text-shadow: a shadow only
 * separates a light star from a light photo by blurring it, and on a white
 * garment the result is a grey smudge. A scrim disc has the same contrast over
 * anything.
 */
const favoriteBadge = css({
  position: 'absolute',
  top: '1.5',
  right: '1.5',
  display: 'grid',
  placeItems: 'center',
  width: '5',
  height: '5',
  rounded: 'full',
  bg: 'overlay.scrim',
  backdropFilter: 'blur(4px)',
  color: 'accent',
})

interface PendingCardProps {
  pending: PendingUpload
  onRetry: (tempId: string) => void
  onDiscard: (tempId: string) => void
}

export function PendingCard({ pending, onRetry, onDiscard }: PendingCardProps) {
  const failed = pending.state === 'failed'
  const preview = pending.photos[0]?.previewUrl

  return (
    <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
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
            })}
          >
            <Spinner size={18} />
          </span>
        )}
      </SquarePhoto>

      <p className={title}>{pending.draft.title}</p>

      {/* Same reserved line the item card uses, so a card that is still
          uploading lines up with the saved ones around it. */}
      <div className={metaRow}>
        {failed ? (
          <span className={css({ textStyle: 'caption', color: 'danger' })}>업로드 실패</span>
        ) : (
          <span className={css({ textStyle: 'caption', color: 'fg.muted' })}>저장 중</span>
        )}
      </div>

      {/* A failed card is deliberately the one card that grows: it is asking to
          be repaired, and the reason and the two actions have to be reachable. */}
      {failed && (
        <div className={vstack({ gap: '1.5', alignItems: 'stretch' })}>
          {pending.error && (
            <p
              className={css({
                fontSize: '2xs',
                color: 'fg.muted',
                lineHeight: 'tight',
                wordBreak: 'break-word',
              })}
            >
              {pending.error}
            </p>
          )}
          {/* Stacked, not side by side. A grid column is about 100px wide on a
              360px phone and two labelled buttons do not fit across it — they
              wrapped mid-word, which is how a repair prompt ends up looking like
              the damage. */}
          <div className={vstack({ gap: '1', alignItems: 'stretch' })}>
            <Button size="sm" variant="outline" full onClick={() => onRetry(pending.tempId)}>
              재시도
            </Button>
            <Button size="sm" variant="ghost" full onClick={() => onDiscard(pending.tempId)}>
              버리기
            </Button>
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
    <div className={vstack({ gap: '2', alignItems: 'stretch' })} aria-hidden="true">
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
