import { useEffect, useState } from 'react'

import { todayLocal } from './calendarDay'

/**
 * 오늘의 로컬 달력 날짜. 앱이 열려 있는 동안 최신으로 유지된다.
 *
 * 렌더마다 시계를 읽으면 컴포넌트가 불순해지고 카드들이 같은 날을 본다는 보장이 없어진다.
 * 반대로 마운트 값을 붙들면 밤새 켜둔 폰이 어제 날짜에 오늘을 기록하겠다고 제안한다.
 *
 * 그래서 세 신호로 다시 읽는다 — **자정 타이머**는 켜둔 채 있는 창을, `visibilitychange`는
 * 절전이라 타이머가 울리지 않은 폰을, `focus`는 숨겨진 적 없이 떠나 있던 데스크톱 탭을
 * 덮는다. 두 이벤트 경로 모두 타이머를 다시 건다 — 이미 지나간 자정을 겨눈 알람이다.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayLocal)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    // 동기화 한 번에 시계 읽기도 한 번. 두 번이면 그 사이에 자정을 걸칠 기회가 두 번이다.
    const sync = () =>
      setToday((current) => {
        const next = todayLocal()
        return next === current ? current : next
      })

    /** 다음 로컬 자정 직후까지 잔 뒤 다시 읽고 다시 건다. */
    function arm() {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setDate(midnight.getDate() + 1)
      // 24시간을 더하지 않고 `setHours(0, …)`로 — 하루가 늘 24시간은 아니고, DST 전환일에
      // 둘은 어긋난다.
      midnight.setHours(0, 0, 0, 0)

      // 경계에서 1초 뒤. 조금 일찍 떨어지는 타이머는 옛 날짜를 읽고 몇 밀리초 뒤로 다시
      // 걸리는, 깨어남이 아니라 회전이 된다.
      timer = setTimeout(
        () => {
          sync()
          arm()
        },
        midnight.getTime() - now.getTime() + 1_000,
      )
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
