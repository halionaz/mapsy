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
 * Three things move it, and all three are needed.
 *
 * A **timer to the next local midnight** is the only one that fires for a window
 * left in front. An earlier version left this out, on the grounds that a timer
 * would be "a background wake-up on every screen that reads this" — which was
 * wrong twice over. It is one `setTimeout` per mount that fires once a day, not
 * a poll; and the sentence that excused it claimed the write path guarded
 * itself, which it cannot: `wearDraft.isUsable` compares a draft against *these*
 * days, so a stale clock validates everything made under the same stale clock.
 * Measured, without the timer: a tab held in the foreground across midnight
 * still labelled the day before yesterday 어제 and submitted against it, and
 * opening a fresh selection wrote the wrong day with no draft involved at all.
 *
 * `visibilitychange` covers the phone that was asleep — timers do not fire while
 * the device is suspended, so the alarm that should have gone off at midnight is
 * still pending when the screen comes back. `focus` adds the desktop tab that
 * was clicked away from without ever being hidden.
 *
 * Both event paths re-arm the timer, because a wake-up that slept through its
 * own midnight is aimed at one that has already passed.
 *
 * The state is replaced only when the strings differ, so the ordinary case —
 * every focus that is not the first after midnight — does not re-render anything.
 */
export function useLocalDays(): LocalDays {
  const [days, setDays] = useState(read)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const sync = () =>
      setDays((current) => {
        const next = read()
        return next.today === current.today && next.yesterday === current.yesterday
          ? current
          : next
      })

    /** Sleeps until just after the next local midnight, then re-reads and re-arms. */
    function arm() {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setDate(midnight.getDate() + 1)
      // Through `setHours(0, …)` rather than by adding 24 hours: a day is not
      // always 24 hours long, and the two disagree on a DST changeover.
      midnight.setHours(0, 0, 0, 0)

      // A second past the boundary. A timer that lands a hair early would read
      // the old day and re-arm for a few milliseconds — a spin rather than a
      // wake-up.
      timer = setTimeout(() => {
        sync()
        arm()
      }, midnight.getTime() - now.getTime() + 1_000)
    }

    const resync = () => {
      sync()
      clearTimeout(timer)
      arm()
    }

    arm()
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('focus', resync)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('focus', resync)
    }
  }, [])

  return days
}
