import { CalendarCheck } from 'lucide-react'
import { css } from 'styled-system/css'

import { Button } from '@/shared/ui/Button'

/**
 * The way in to 착용 기록, at the bottom-right corner of the wardrobe.
 *
 * ```
 * 기록 없음   [ ✓ 기록하기 ]   ← 스크롤하면 아이콘만 남음
 * 기록 있음   [ ✓ 어제 3벌 ]
 * ```
 *
 * Two states, not three: once it is pressed the whole bottom row is replaced by
 * `WearSelectionBar`, so this button has nothing to say while garments are being
 * picked. It is only the resting form.
 *
 * The same size as 옷 등록 beside it. The hierarchy between them is carried by
 * the fill — that one is the accent with a tinted glow under it, this one a
 * neutral surface — and not by height. Two pills of different heights on one
 * line read as one of them having been squeezed in, which is not what either of
 * them is.
 *
 * They are pinned separately, the register button to the exact centre of the
 * screen and this one to the right edge of the app column, so on a phone the
 * pair has only the column's width to share while this label is open. The
 * collapse below is what gives it back.
 */
interface WearFabProps {
  /** 오늘 or 어제 — the day the button opens on. */
  dayLabel: string
  /** How many garments that day already holds. */
  recordedCount: number
  /** True once the grid has been scrolled. */
  collapsed: boolean
  onOpen: () => void
}

export function WearFab({ dayLabel, recordedCount, collapsed, onOpen }: WearFabProps) {
  const recorded = recordedCount > 0
  const label = recorded ? `${dayLabel} ${recordedCount}벌` : '기록하기'

  return (
    <Button
      variant="surface"
      icon={<CalendarCheck />}
      // Named even while the label is folded away, so the collapsed button is
      // not an unlabelled glyph to anything reading the page aloud.
      aria-label={recorded ? `${label} 기록 고치기` : `${dayLabel} 입은 옷 기록하기`}
      onClick={onOpen}
      className={floating}
    >
      {/*
       * Only the invitation folds. `어제 3벌` is the half of the pair carrying
       * the thing the user came back to check, and it is short enough to keep;
       * `기록하기` has said everything it has to say by the time the grid starts
       * moving.
       */}
      <span className={collapsible} data-collapsed={(!recorded && collapsed) || undefined}>
        {label}
      </span>
    </Button>
  )
}

/** Lifts the button off the grid it floats over. */
const floating = css({ boxShadow: 'raised' })

/**
 * The label, folding away to nothing.
 *
 * `max-width` rather than unmounting the text, so the button narrows over a
 * couple of frames instead of snapping. The negative margin takes the button's
 * own `gap` with it; without it a collapsed label still holds the space the gap
 * was reserving next to it.
 *
 * The ceiling only has to be larger than the longest label this ever holds; it
 * is a bound for the transition to run against, not a width.
 */
const collapsible = css({
  display: 'inline-block',
  overflow: 'hidden',
  maxWidth: '12rem',
  whiteSpace: 'nowrap',
  transitionProperty: 'max-width, opacity, margin-left',
  transitionDuration: 'normal',
  transitionTimingFunction: 'out',
  '&[data-collapsed]': {
    maxWidth: '0',
    opacity: 0,
    ml: '-2',
  },
  _motionReduce: { transitionDuration: '1ms' },
})
