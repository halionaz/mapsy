import { css } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

import {
  CardSkeleton,
  ItemCard,
  PendingCard,
  SelectableItemCard,
  type PendingUpload,
  type WardrobeItem,
} from '@/entities/item'
import type { Worn } from '@/entities/wear'
import type { WardrobeSection } from '../lib/sections'

/**
 * The cards, and only the cards.
 *
 * Pulled out of `WardrobePage` when selection mode arrived. The screen has one
 * grid and now two things a tap on it can mean, and keeping the branch here
 * leaves the page about *which* of its five views is on show — the decision it
 * already had, and the one its `View` union is written around.
 *
 * `grid` lives here as a result, which is the other half of the move: the same
 * three columns are used by the pending row, the sections and the skeleton, and
 * those were the last three things in the page reaching for it.
 */
interface WardrobeGridProps {
  /** Already filtered and split — see `lib/sections`. */
  sections: WardrobeSection<Worn<WardrobeItem>>[]
  pending: PendingUpload[]
  onRetry: (tempId: string) => void
  onDiscard: (tempId: string) => void
  /** Draw the category headings. False when there is only one section to name. */
  sectioned: boolean
  /** Today, for the "last worn" line on each card. */
  today: string
  /** Ids picked so far, or null when no selection is in progress. */
  selectedIds: Set<string> | null
  onToggleItem: (itemId: string) => void
}

export function WardrobeGrid({
  sections,
  pending,
  onRetry,
  onDiscard,
  sectioned,
  today,
  selectedIds,
  onToggleItem,
}: WardrobeGridProps) {
  return (
    <>
      {/* Pinned to the top, in a grid of their own, and outside both the
          filters and the sections. Filing an upload under its category would
          bury it — a failed one has to stay where the retry can be found, and
          hiding it behind a heading reads as data loss while its photos are
          still going up.

          Not selectable either, and not because it was overlooked: a
          registration in flight has no row and therefore no id to record a wear
          against. It becomes an ordinary card the moment it lands. */}
      {pending.length > 0 && (
        <ul className={grid}>
          {pending.map((entry) => (
            <li key={entry.tempId}>
              <PendingCard pending={entry} onRetry={onRetry} onDiscard={onDiscard} />
            </li>
          ))}
        </ul>
      )}

      {/* Tidiness, not a fix: with only an upload in flight this would be a flex
          column holding nothing. No test — the DOM says plainly whether it is
          there, but nothing on screen depends on it. */}
      {sections.length > 0 && (
        <div className={vstack({ gap: '7', alignItems: 'stretch' })}>
          {sections.map((section) => (
            <section key={section.group.id} className={vstack({ gap: '3', alignItems: 'stretch' })}>
              {sectioned && (
                <h2 className={sectionHeading}>
                  {section.group.label}
                  <span className={css({ ml: '2', color: 'fg.subtle' })}>
                    {section.items.length}
                  </span>
                </h2>
              )}
              <ul className={grid}>
                {section.items.map((item) => (
                  <li key={item.id}>
                    {selectedIds ? (
                      <SelectableItemCard
                        item={item}
                        today={today}
                        selected={selectedIds.has(item.id)}
                        onToggle={() => onToggleItem(item.id)}
                      />
                    ) : (
                      <ItemCard item={item} today={today} />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * The same three columns with nothing in them yet, for the first load.
 *
 * Here rather than in the page so it shares `grid` with the real thing — that
 * sharing is the whole point of a skeleton, and a copy of the track definition
 * beside it is a copy that can stop matching.
 */
export function GridSkeleton() {
  return (
    // The placeholders are decoration — six empty list items is not what a
    // screen reader should be given to walk through.
    <ul className={grid} aria-hidden="true">
      {SKELETON_KEYS.map((key) => (
        <li key={key}>
          <CardSkeleton />
        </li>
      ))}
    </ul>
  )
}

const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e', 'f']

/**
 * A category's name over its cards.
 *
 * `heading` rather than `subheading`: it is the only thing standing between two
 * grids of photographs, and it has to survive being read past at a scroll.
 */
const sectionHeading = css({ textStyle: 'heading' })

/**
 * Shared by the loaded grid and the loading one, so the placeholders sit on the
 * same lines the cards will occupy and the screen doesn't reflow when the data
 * lands.
 */
const grid = css({
  display: 'grid',
  // `minmax(0, …)`, not a bare `1fr`.
  //
  // `1fr` is shorthand for `minmax(auto, 1fr)`, and that `auto` is the item's
  // automatic minimum size — which for a card is the min-content width of its
  // title. Titles are `white-space: nowrap`, so a title's min-content width is
  // the whole untruncated string: `overflow: hidden` decides what is *drawn*,
  // never what the text asks for. The result was a grid whose columns were
  // sized by how long each garment's name happened to be — 와이드진 wide, 흰 티
  // narrow — and since the photo is a square that fills its column, the longer
  // name also produced a taller card. Every card looked like a different size
  // because every name was a different length.
  //
  // A zero floor lets the three tracks be equal and leaves the clipping to the
  // title, which is what was asked of it.
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  // The same automatic minimum applies to the item inside the track, where it
  // would push the card back out over the track it was just made to fit.
  '& > li': { minWidth: 0 },
  gap: '3',
  listStyle: 'none',
  p: '0',
  m: '0',
})
