import { daysBetween, monthsBetween, parseDay } from './calendarDay'

/** 원 단위 정수로 저장하므로 통화 기호가 아니라 사람이 읽는 자릿수 구분으로 쓴다. */
export function formatPrice(price: number | null): string | null {
  if (price == null) return null
  return `${price.toLocaleString('ko-KR')}원`
}

/**
 * `YYYY-MM-DD` → "2025. 11. 2."
 *
 * `new Date(iso)`를 거치지 않고 조각에서 짓는다. 날짜만 있는 문자열은 UTC 자정으로
 * 파싱되어, 음수 오프셋 타임존에서는 하루 전날로 그려진다.
 */
export function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!match) return null
  const [, year, month, day] = match
  return `${year}. ${Number(month)}. ${Number(day)}.`
}

/**
 * `8.14` — 옆에서 이미 말로 날을 부르고 있는 컨트롤용.
 *
 * `formatDate`와 달리 연도도 0 채움도 없다. 이쪽은 `8.14 (어제)` 안에 들어가고,
 * 숫자는 기록되는 날이 상대적인 말이 아니라 실제 날짜임을 보이기 위해서만 있다.
 */
export function formatMonthDay(iso: string): string | null {
  const day = parseDay(iso)
  return day ? `${day.month}.${day.day}` : null
}

/**
 * 며칠 전인지를, 아직 뜻이 있는 가장 굵은 단위로 — 오늘 · 어제 · 5일 전 · 3주 전 ·
 * 2개월 전 · 1년 전.
 *
 * `today`를 시계에서 읽지 않고 받는다. 카드 격자가 각자 물어 자정을 사이에 두고
 * 어긋나면 안 되고, 시간을 얼리지 않고도 테스트할 수 있게 한다.
 */
export function formatDayAgo(iso: string, today: string): string | null {
  const days = daysBetween(iso, today)
  if (days == null) return null

  // 음수로 그리지 않고 가둔다. DB는 서버보다 하루 앞선 착용 기록을 받아주고(타임존
  // 허용치다) 동쪽으로 옮겨간 폰은 정당하게 "내일"의 행을 본다.
  if (days <= 0) return '오늘'
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  if (days < 28) return `${Math.floor(days / 7)}주 전`

  const months = monthsBetween(iso, today)
  if (months == null) return null

  // 4주가 지나도 달력상 0개월일 수 있다 — 1월 3일에서 1월 31일이 그렇다 — 그리고
  // 0개월 전은 문장이 아니다.
  if (months < 12) return `${Math.max(1, months)}개월 전`
  return `${Math.floor(months / 12)}년 전`
}
