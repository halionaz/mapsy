import { Check, X } from 'lucide-react'
import { css } from 'styled-system/css'

import { formatMonthDay } from '@/shared/lib/format'
import { Button, IconButton } from '@/shared/ui/Button'

/**
 * The bottom row while garments are being picked — it replaces 옷 등록 and the
 * wear button rather than sitting above them.
 *
 * ```
 * [ 8.14 (어제) ] [    3벌 기록    ] [ ✕ ]
 * ```
 *
 * Down here rather than in a strip above the grid, which is where the day and
 * the cancel used to live. Both of them are things the thumb reaches for while
 * scrolling a wardrobe, and the top of the screen is the one place a thumb is
 * not — the same reason the button that opens this mode is at the bottom.
 *
 * The date is a button, not a pair of tabs: there are exactly two days, so a
 * control that shows one and swaps to the other says the same thing in half the
 * width. It carries the actual date as well as the word — `어제` alone is a
 * relative label on a screen that may have been left open since yesterday, and
 * `8.14` is what makes it checkable.
 */
interface WearSelectionBarProps {
  /** The day being written. */
  wornOn: string
  /** What that day is called, and what pressing the date would switch to. */
  dayLabel: string
  otherDayLabel: string
  selectedCount: number
  /** What the day held before this selection started. */
  recordedCount: number
  submitting: boolean
  onToggleDay: () => void
  onSubmit: () => void
  onCancel: () => void
}

export function WearSelectionBar({
  wornOn,
  dayLabel,
  otherDayLabel,
  selectedCount,
  recordedCount,
  submitting,
  onToggleDay,
  onSubmit,
  onCancel,
}: WearSelectionBarProps) {
  /**
   * Submitting nothing is two different things, and only one of them is a
   * mistake.
   *
   * Clearing every garment off a day that has some is a real edit — "I did not
   * wear any of that after all" — and the database function accepts an empty set
   * for exactly that. Pressing submit on a day that was already empty does
   * nothing at all, and a button that does nothing should not be pressable.
   */
  const clearing = selectedCount === 0 && recordedCount > 0

  return (
    <div className={bar}>
      <Button
        variant="surface"
        onClick={onToggleDay}
        aria-label={`기록할 날짜 ${dayLabel}. 눌러서 ${otherDayLabel}로 바꾸기`}
        className={floating}
      >
        {formatMonthDay(wornOn) ?? wornOn} ({dayLabel})
      </Button>

      {/* `full` so this takes whatever the other two leave, and shrinks first
          when a long day label and a two-digit count arrive together. */}
      <Button
        full
        icon={<Check />}
        loading={submitting}
        disabled={selectedCount === 0 && recordedCount === 0}
        onClick={onSubmit}
        className={floating}
      >
        {selectedCount > 0
          ? `${selectedCount}벌 기록`
          : clearing
            ? '기록 지우기'
            : '옷을 골라주세요'}
      </Button>

      {/* A glyph rather than the word: three labelled pills do not fit across a
          phone, and this is the one of the three whose meaning a bare ✕ already
          carries. With nothing picked the submit button is disabled, so this is
          the only way out of the mode — which is why it is never the control
          that gives up its width. */}
      <IconButton label="고르기 취소" filled onClick={onCancel} className={floating}>
        <X size={18} />
      </IconButton>
    </div>
  )
}

const floating = css({ boxShadow: 'raised' })

/**
 * Pinned above the home indicator and held to the app column, not the window —
 * the shell centres a 480px column and a full-width row would put the cancel
 * button somewhere off in the page margin on a tablet.
 */
const bar = css({
  position: 'fixed',
  bottom: 'calc({spacing.6} + var(--safe-b))',
  left: '50%',
  translate: 'auto',
  translateX: '-1/2',
  zIndex: 'fab',
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  width: 'calc(100vw - {spacing.10})',
  maxWidth: 'calc({sizes.app} - {spacing.10})',
})
