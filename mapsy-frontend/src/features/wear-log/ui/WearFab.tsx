import { CalendarCheck, Check } from 'lucide-react'
import { css } from 'styled-system/css'

import { Button } from '@/shared/ui/Button'

/**
 * The one button 착용 기록 happens through, in the three states it moves between.
 *
 * ```
 * ① 오늘 기록 없음   [ ✓ 오늘 입은 옷 ]   ← 스크롤하면 아이콘만 남음
 * ② 고르는 중        [ 오늘 3벌 기록  ]   ← 고른 수가 그대로 라벨
 * ③ 오늘 기록 있음   [ ✓ 오늘 3벌     ]   ← 다시 눌러 고침
 * ```
 *
 * One button rather than three, because what has to be legible at a glance is
 * *what to do next*, and that is always written on it. ③ in particular is not a
 * disappearance: recording one garment in the morning and adding a jacket at
 * lunch is the ordinary shape of a day, so the button that recorded it has to
 * still be there and still say what it holds.
 *
 * Deliberately dumb about days and ids — it is handed counts and a label. Which
 * day is being written, and what a day already holds, are the wardrobe screen's
 * to know.
 */
interface WearFabProps {
  /** 오늘 or 어제 — the day this button is about. */
  dayLabel: string
  /** How many garments that day already holds on the server. */
  recordedCount: number
  /** Garments picked so far, or null when no selection is in progress. */
  selectedCount: number | null
  /** True once the grid has been scrolled — see the label note below. */
  collapsed: boolean
  submitting: boolean
  onOpen: () => void
  onSubmit: () => void
}

export function WearFab({
  dayLabel,
  recordedCount,
  selectedCount,
  collapsed,
  submitting,
  onOpen,
  onSubmit,
}: WearFabProps) {
  if (selectedCount === null) {
    /**
     * Only the nudge collapses, and only because it is the long one.
     *
     * `오늘 3벌` is four glyphs and a space where the invitation is six, so it
     * costs the row much less — and it is the half of the pair carrying the
     * thing the user came back to check. The invitation has said everything it
     * has to say by the time the grid starts moving.
     */
    const recorded = recordedCount > 0
    const label = recorded ? `${dayLabel} ${recordedCount}벌` : `${dayLabel} 입은 옷`

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
        <span className={collapsible} data-collapsed={(!recorded && collapsed) || undefined}>
          {label}
        </span>
      </Button>
    )
  }

  /**
   * Submitting nothing is two different things, and only one of them is a
   * mistake.
   *
   * Clearing every garment off a day that has some is a real edit — "I did not
   * wear any of that after all" — and the function accepts an empty set for
   * exactly that. Pressing submit on a day that was already empty does nothing
   * at all, and a button that does nothing should not be pressable.
   */
  const clearing = selectedCount === 0 && recordedCount > 0

  return (
    <Button
      icon={<Check />}
      loading={submitting}
      disabled={selectedCount === 0 && recordedCount === 0}
      onClick={onSubmit}
      className={floating}
    >
      {selectedCount > 0
        ? `${dayLabel} ${selectedCount}벌 기록`
        : clearing
          ? `${dayLabel} 기록 지우기`
          : '옷을 골라주세요'}
    </Button>
  )
}

/** Lifts the button off the grid it floats over. */
const floating = css({ boxShadow: 'raised' })

/**
 * The label, folding away to nothing.
 *
 * `max-width` rather than unmounting the text: the row is centred, so a label
 * that vanishes in one frame shifts the register FAB beside it by half the width
 * it gave up — a jump, mid-scroll, on a button nobody was looking at. Animating
 * the width lets the pair settle instead. The negative margin takes the button's
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
