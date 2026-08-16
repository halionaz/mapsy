/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useToday } from './useToday'

/**
 * 훅은 "앱이 열려 있는 동안" 날짜가 최신으로 유지된다고 약속하고, 아무도 건드리지 않는
 * 창에 대해 그것을 참으로 만드는 유일한 장치가 타이머다.
 *
 * 없으면 자정을 넘겨 앞에 둔 탭이 어제의 답을 끝없이 붙들고 있었고, 그것을 무해하게
 * 만들 가드는 같은 값과 비교하므로 그럴 수 없다.
 */
afterEach(() => {
  vi.useRealTimers()
})

describe('useToday', () => {
  it('아무 이벤트 없이도 자정에 넘어간다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 15, 23, 59, 0))

    const { result } = renderHook(() => useToday())
    expect(result.current).toBe('2026-08-15')

    // visibilitychange도 focus도 없다 — 그냥 창을 보고 있었을 뿐이다.
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000)
    })

    expect(result.current).toBe('2026-08-16')
  })

  it('첫날 이후에도 계속 넘어간다', () => {
    // 타이머가 스스로 다시 걸린다. 한 번만 울리는 판본은 둘째 밤에 다시 낡고, 그 사이
    // 하루 동안은 고쳐진 것처럼 보인다.
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

  it('자기 자정을 자며 지나친 깨어남을 따라잡는다', () => {
    // 기기가 절전이면 타이머가 울리지 않아, 자정에 맞춘 알람이 화면이 돌아올 때까지
    // 대기 중이다. 이벤트 경로는 다시 읽고 다시 걸어야 한다 — 읽기만 하면 다음 넘어감이
    // 이미 지나간 자정을 겨눈다.
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

  it('날이 바뀌지 않았으면 다시 그리지 않는다', () => {
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
