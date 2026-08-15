import { useEffect, useState } from 'react'

import { todayLocal } from './calendarDay'

/**
 * Today, as a local calendar day, kept current while the app stays open.
 *
 * Read once per mount and then re-read on the three signals below, rather than
 * on every render. Reading the clock during render would make every component
 * that does it impure and give a grid of cards no guarantee they agree with each
 * other; holding the mount value for ever is the other failure — a phone left on
 * the wardrobe overnight would offer to record 오늘 against yesterday's date,
 * which is the one mistake this whole date pipeline exists to prevent.
 *
 * A **timer to the next local midnight** is the only one of the three that fires
 * for a window left in front. An earlier version left it out on the grounds that
 * a timer would be "a background wake-up on every screen that reads this", which
 * was wrong twice over: it is one `setTimeout` per mount that fires once a day,
 * not a poll, and the sentence excusing it claimed the write path guarded
 * itself, which it cannot — `wearDraft.isUsable` compares a draft against *this*
 * value, so a stale clock validates everything made under the same stale clock.
 *
 * `visibilitychange` covers the phone that was asleep — timers do not fire while
 * a device is suspended, so the alarm that should have gone off at midnight is
 * still pending when the screen comes back. `focus` adds the desktop tab that
 * was clicked away from without ever being hidden.
 *
 * Both event paths re-arm the timer, because a wake-up that slept through its
 * own midnight is aimed at one that has already passed.
 *
 * The state is replaced only when the string differs, so the ordinary case —
 * every focus that is not the first after midnight — does not re-render anything.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayLocal)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    // One clock read per sync. Two would be two chances to straddle a midnight
    // between them — the invariant the two-day version stated explicitly and
    // this one dropped on the way over.
    const sync = () =>
      setToday((current) => {
        const next = todayLocal()
        return next === current ? current : next
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

  return today
}
