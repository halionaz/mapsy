import { Check, X } from 'lucide-react'
import { css } from 'styled-system/css'

import { formatMonthDay } from '@/shared/lib/format'
import { Button, IconButton } from '@/shared/ui/Button'

/**
 * The bottom row while garments are being picked — it replaces 옷 등록 and the
 * wear button rather than sitting above them.
 *
 * ```
 * [ 8.15 (오늘) ] [    3벌 기록    ] [ ✕ ]
 * ```
 *
 * Down here rather than in a strip above the grid, which is where the day and
 * the cancel used to live. Both of them are things the thumb reaches for while
 * scrolling a wardrobe, and the top of the screen is the one place a thumb is
 * not — the same reason the button that opens this mode is at the bottom.
 *
 * The date is a **label, not a control**. Only today is writable, so there is
 * nothing to switch to; a pill that looks pressable and answers nothing is worse
 * than a plain one. It still carries the actual date as well as the word,
 * because `오늘` alone is a relative claim on a screen that may have been open
 * since before midnight, and `8.15` is what makes it checkable.
 *
 * Picking any other day is a date picker, and that is its own issue. Until then
 * `wearDraft.isUsable` is what keeps the word true — a draft whose day is no
 * longer today is not returned at all, so this never renders `(오늘)` over a
 * date that is not.
 */
interface WearSelectionBarProps {
  /** The day being written. Always today; see above. */
  wornOn: string
  selectedCount: number
  /** What the day held before this selection started. */
  recordedCount: number
  submitting: boolean
  onSubmit: () => void
  onCancel: () => void
}

export function WearSelectionBar({
  wornOn,
  selectedCount,
  recordedCount,
  submitting,
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

  /** Written once so the printed date and the spoken one cannot drift apart. */
  const day = `${formatMonthDay(wornOn) ?? wornOn} (오늘)`

  return (
    /* The date rides in the group's name, and it has to: the paragraph below is
       not focusable and carries no role, so nothing in tab order says which day
       is being written. Labelling the paragraph itself would not carry either —
       `aria-label` on an element with no role is ignored by most screen readers.
       Putting it on the group is what keeps the reason the date is printed at
       all — a screen open since before midnight — true for everyone. */
    <div className={bar} role="group" aria-label={`${day} 입은 옷 고르기`}>
      <p className={dateLabel}>{day}</p>

      {/* `full` so this takes whatever the other two leave, and shrinks first
          when a two-digit count arrives. */}
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
 * The day, drawn as what it is.
 *
 * Same height and radius as the two buttons beside it so the row sits on one
 * line, and deliberately none of the things that say "press me" — no border, no
 * hover, no pointer, and `fg.muted` rather than `fg`. It reads as the caption on
 * the row, which is what it is until there is a picker behind it.
 */
const dateLabel = css({
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
  minHeight: 'tap',
  px: '4',
  rounded: 'full',
  bg: 'bg.elevated',
  color: 'fg.muted',
  textStyle: 'label',
  whiteSpace: 'nowrap',
  boxShadow: 'raised',
})

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
