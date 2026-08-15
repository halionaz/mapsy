/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useToday } from './useToday'

/**
 * The hook promises the day stays current "while the app stays open", and the
 * only mechanism that keeps that true for a window nobody touches is the timer.
 *
 * Without it a tab held in the foreground across midnight kept yesterday's
 * answer indefinitely — and the guard that was supposed to make that harmless
 * cannot, because it compares against this same value.
 */
afterEach(() => {
  vi.useRealTimers()
})

describe('useToday', () => {
  it('rolls over at midnight with no event of any kind', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 15, 23, 59, 0))

    const { result } = renderHook(() => useToday())
    expect(result.current).toBe('2026-08-15')

    // No visibilitychange, no focus — the window was simply looked at.
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000)
    })

    expect(result.current).toBe('2026-08-16')
  })

  it('keeps rolling over on the days after the first', () => {
    // The timer re-arms itself; a version that fired once would go stale again
    // on the second night and look fixed for a whole day in between.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 15, 23, 59, 0))

    const { result } = renderHook(() => useToday())

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000)
    })
    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000)
    })

    expect(result.current).toBe('2026-08-17')
  })

  it('catches up on a wake-up that slept through its own midnight', () => {
    // Timers do not fire while a device is suspended, so the alarm set for
    // midnight is still pending when the screen comes back. The event path has
    // to both re-read and re-arm; only re-reading would leave the next rollover
    // aimed at a midnight that has already gone by.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 15, 23, 59, 0))

    const { result } = renderHook(() => useToday())

    act(() => {
      vi.setSystemTime(new Date(2026, 7, 17, 9, 0, 0))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe('2026-08-17')

    act(() => {
      vi.advanceTimersByTime(16 * 60 * 60 * 1000)
    })
    expect(result.current).toBe('2026-08-18')
  })

  it('does not re-render when the day has not changed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 15, 10, 0, 0))

    let renders = 0
    renderHook(() => {
      renders += 1
      return useToday()
    })
    const before = renders

    act(() => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(renders).toBe(before)
  })
})
