import { X } from 'lucide-react'
import { css } from 'styled-system/css'
import { hstack } from 'styled-system/patterns'

import { buttonStyle } from '@/shared/ui/buttonStyle'
import { chipStyle } from '@/shared/ui/chipStyle'

/**
 * The row that appears above the wardrobe's controls while garments are being
 * picked — `[오늘 | 어제]` on the left, 취소 on the right.
 *
 * One line carrying both of the things selection mode needs and the grid cannot
 * express. The day, because the app records 어제 as well as 오늘 and the FAB's
 * label alone ("어제 3벌 기록") is the wrong place to *change* it. And a way out:
 * with nothing picked the submit button is disabled, so without this there is no
 * button on the screen that leaves the mode.
 *
 * Inside the sticky control bar rather than above it, so it is still reachable
 * from the bottom of a long wardrobe — which is where the garment that made
 * someone want to change the day usually is.
 */
interface WearModeBarProps {
  /** The day being written. */
  wornOn: string
  today: string
  yesterday: string
  onPickDay: (day: string) => void
  onCancel: () => void
}

export function WearModeBar({ wornOn, today, yesterday, onPickDay, onCancel }: WearModeBarProps) {
  return (
    <div className={bar}>
      {/* `aria-pressed` rather than a radiogroup: two buttons that each say
          whether they are the current one is the same thing a segmented control
          means, without a roving tabindex to get wrong. */}
      <div className={hstack({ gap: '2' })}>
        {DAYS.map(({ label, value }) => {
          const day = value === 'today' ? today : yesterday
          return (
            <button
              key={value}
              type="button"
              aria-pressed={wornOn === day}
              className={chipStyle({ active: wornOn === day })}
              onClick={() => onPickDay(day)}
            >
              {label}
            </button>
          )
        })}
      </div>

      <button type="button" onClick={onCancel} className={buttonStyle({ variant: 'ghost', size: 'sm' })}>
        취소
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * The two days, as a table rather than two hand-written buttons.
 *
 * Small, and the reason is the same one the category rail has: the pair has to
 * stay in this order and stay styled identically, and two copies of a five-line
 * button is where that stops being true.
 */
const DAYS = [
  { value: 'today', label: '오늘' },
  { value: 'yesterday', label: '어제' },
] as const

const bar = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '2',
  px: '5',
})
