import { useEffect, useState } from 'react'

import { todayLocal, yesterdayLocal } from './calendarDay'

export interface LocalDays {
  today: string
  yesterday: string
}

function read(): LocalDays {
  // One `Date`, both days. Two separate clock reads could straddle midnight and
  // produce a pair that is two days apart — which the 오늘/어제 switch would then
  // present as adjacent.
  const now = new Date()
  return { today: todayLocal(now), yesterday: yesterdayLocal(now) }
}

/**
 * The local calendar days the app can write to, kept current while it stays
 * open.
 *
 * Read once per mount and then again whenever the tab is looked at, rather than
 * on every render. Reading the clock during render would make every component
 * that does it impure and give a grid of cards no guarantee they agree; holding
 * the mount value for ever is the other failure — a phone left on the wardrobe
 * overnight would offer to record 오늘 against yesterday's date, which is the one
 * mistake this whole date pipeline exists to prevent.
 *
 * `visibilitychange` is what actually catches that: a phone that crossed
 * midnight has had its screen off, and coming back to it is the event. `focus`
 * adds the tab that was clicked away from and back to without ever being
 * hidden — a second window, another app on a desktop.
 *
 * Neither fires for a window that is simply left in front, so a screen watched
 * across midnight without a single interruption keeps yesterday's answer. That
 * gap is not closed here: a timer to midnight would be a background wake-up on
 * every screen that reads this, and the write path guards itself — the draft is
 * dropped once its day is no longer one of the two (`wearDraft.isUsable`), so
 * the failure is a selection that closes rather than a day recorded wrong.
 *
 * The state is replaced only when the strings differ, so the ordinary case —
 * every focus that is not the first after midnight — does not re-render anything.
 */
export function useLocalDays(): LocalDays {
  const [days, setDays] = useState(read)

  useEffect(() => {
    const sync = () =>
      setDays((current) => {
        const next = read()
        return next.today === current.today && next.yesterday === current.yesterday
          ? current
          : next
      })

    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
    }
  }, [])

  return days
}
