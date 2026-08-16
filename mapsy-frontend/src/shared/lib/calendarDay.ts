/**
 * 입은 사람이 있는 달력 날짜, `YYYY-MM-DD`.
 *
 * 착용은 순간이 아니라 날에 기록된다 — 주머니 속 폰의 오늘이다. 그래서 여기의 모든 값은
 * 로컬 시계에서 오고 UTC를 거치지 않는다.
 *
 * 이 파일이 대신하는 한 줄은 `new Date().toISOString().slice(0, 10)`이다. UTC로 먼저
 * 바꾸므로 서울에서는 9시 이전에 고른 옷이 매번 전날로 기록되고, 아무것도 고장 나 보이지
 * 않는다.
 *
 * `supabase/migrations/20260815000001_item_wears.sql`이 같은 규칙의 나머지 절반이다 —
 * 컬럼이 기본값 없는 `date`라 서버가 몰래 자기 날짜를 채울 수 없다.
 */

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export interface CalendarDay {
  year: number
  month: number
  day: number
}

/**
 * `YYYY-MM-DD`를 파싱하거나, 아니면 null.
 *
 * 왕복이 곧 검증이다. `Date.UTC`는 거부하지 않고 넘긴다 — 13월은 다음 해 1월, 32일은
 * 1일이 된다 — 그래서 Date를 만들었다 되읽는 것이 진짜 날짜와 넘어간 날짜를 가른다.
 * 정규식만으로는 `2026-13-40`이 통과한다.
 */
export function parseDay(iso: string): CalendarDay | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!match) return null

  const [, year, month, day] = match
  const parsed = { year: Number(year), month: Number(month), day: Number(day) }
  const rolled = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
  if (Number.isNaN(rolled.getTime())) return null

  return rolled.getUTCFullYear() === parsed.year &&
    rolled.getUTCMonth() + 1 === parsed.month &&
    rolled.getUTCDate() === parsed.day
    ? parsed
    : null
}

/**
 * `from`에서 `to`까지 며칠인지.
 *
 * 산술은 일부러 UTC를 거친다 — 위 규칙과 어긋나지 않는다. 양끝이 모두 UTC 자정이라
 * 차이는 로컬 시계와 무관하게 정수 일수가 된다. 같은 뺄셈을 로컬 Date로 하면 DST 경계에서
 * 깨진다.
 */
export function daysBetween(from: string, to: string): number | null {
  const start = parseDay(from)
  const end = parseDay(to)
  if (!start || !end) return null

  const DAY_MS = 86_400_000
  return Math.round(
    (Date.UTC(end.year, end.month - 1, end.day) -
      Date.UTC(start.year, start.month - 1, start.day)) /
      DAY_MS,
  )
}

/**
 * `from`에서 `to`까지 달력상 몇 달인지.
 *
 * `days / 30`이 아니라 달력에서 센다 — 360일이 그 계산으로는 12개월이라, 1년 전에 입은
 * 코트가 1년 전 대신 12개월 전으로 읽힌다. 여기서는 같은 일자가 돌아와야 한 달이 지나고,
 * 마지막 뺄셈이 그때까지 그것을 유보한다.
 */
export function monthsBetween(from: string, to: string): number | null {
  const start = parseDay(from)
  const end = parseDay(to)
  if (!start || !end) return null

  const elapsed = (end.year - start.year) * 12 + (end.month - start.month)
  return elapsed - (end.day < start.day ? 1 : 0)
}
