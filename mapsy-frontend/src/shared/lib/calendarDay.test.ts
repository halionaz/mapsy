import { describe, expect, it } from 'vitest'
import { daysBetween, monthsBetween, parseDay, todayLocal } from './calendarDay'

/**
 * 여기 모든 단언이 시계를 읽지 않고 `Date`를 고정한다. 실패는 스위트가 애매한 시각에
 * 돌았다는 뜻이 아니라 산술이 바뀌었다는 뜻이다.
 */

describe('todayLocal', () => {
  it('UTC가 아니라 로컬 달력 날짜를 읽는다', () => {
    // 이것이 지키는 회귀는 대체한 한 줄, `toISOString().slice(0, 10)`이다. 서울에서
    // 15일 08:00은 UTC로 아직 14일이라, 그 모양은 매일 아침 한나절의 옷을 전날로
    // 기록하면서 아무것도 고장 나 보이지 않는다.
    const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
      ?.env
    const original = env?.TZ
    if (env) env.TZ = 'Asia/Seoul'
    try {
      const morning = new Date('2026-08-14T23:30:00Z') // 15일 08:30 KST
      // 대체된 한 줄이 무엇으로 답하는지를 적어 둔다. `toISOString`은 프로세스 타임존과
      // 무관하게 UTC이므로 이것은 위 고정에 대한 검사가 아니라 틀린 답의 기록이다 —
      // `env.TZ`가 먹히지 않게 되면 아래 단언이 요란하게 깨진다.
      expect(morning.toISOString().slice(0, 10)).toBe('2026-08-14')
      expect(todayLocal(morning)).toBe('2026-08-15')
    } finally {
      if (env) env.TZ = original
    }
  })

  it('0으로 채워 문자열이 날짜처럼 정렬된다', () => {
    // 고정 폭이 `lastWornOn`을 파싱하지 않고 `>`로 비교할 수 있게 한다 — `summarizeWears` 참고.
    expect(todayLocal(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
  })
})

describe('parseDay', () => {
  it('달력 날짜를 읽는다', () => {
    expect(parseDay('2026-08-15')).toEqual({ year: 2026, month: 8, day: 15 })
  })

  it('날짜처럼 생기기만 한 것을 거부한다', () => {
    // `Date.UTC`는 거부하지 않고 넘긴다 — 13월은 다음 해 1월, 32일은 1일 — 그래서
    // 정규식만으로는 전혀 다른 날짜가 되어 통과한다.
    expect(parseDay('2026-13-01')).toBeNull()
    expect(parseDay('2026-02-30')).toBeNull()
    expect(parseDay('2026-08-32')).toBeNull()
  })

  it('맨 날짜가 아닌 것은 거부한다', () => {
    expect(parseDay('2026-8-15')).toBeNull()
    expect(parseDay('2026-08-15T00:00:00Z')).toBeNull()
    expect(parseDay('어제')).toBeNull()
    expect(parseDay('')).toBeNull()
  })
})

describe('daysBetween', () => {
  it('앞으로 며칠인지 센다', () => {
    expect(daysBetween('2026-08-10', '2026-08-15')).toBe(5)
  })

  it('달과 윤년을 가로질러 센다', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1)
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
  })

  it('둘째 날이 더 이르면 음수가 된다', () => {
    expect(daysBetween('2026-08-15', '2026-08-14')).toBe(-1)
  })

  it('어느 한쪽이라도 날짜가 아니면 null이다', () => {
    expect(daysBetween('어제', '2026-08-15')).toBeNull()
    expect(daysBetween('2026-08-15', '2026-02-30')).toBeNull()
  })
})

describe('monthsBetween', () => {
  it('같은 일자가 돌아올 때까지 기다린다', () => {
    expect(monthsBetween('2026-01-15', '2026-02-14')).toBe(0)
    expect(monthsBetween('2026-01-15', '2026-02-15')).toBe(1)
  })

  it('1년을 12로 센다', () => {
    // `days / 30`은 여기서 12.16을, 360일에서 12를 주는데 그것이
    // 1년 전에 입은 코트에 12개월 전이 붙는다.
    expect(monthsBetween('2025-08-15', '2026-08-15')).toBe(12)
    expect(monthsBetween('2025-09-01', '2026-08-26')).toBe(11)
  })

  it('어느 한쪽이라도 날짜가 아니면 null이다', () => {
    expect(monthsBetween('2026-08-15', '')).toBeNull()
  })
})
