import { describe, expect, it } from 'vitest'
import { formatDate, formatDayAgo, formatMonthDay, formatPrice } from './format'

describe('formatPrice', () => {
  it('천 단위를 끊고 원을 붙인다', () => {
    expect(formatPrice(220000)).toBe('220,000원')
  })

  it('0을 없음으로 보지 않고 그대로 둔다', () => {
    // 선물이나 물려받은 옷은 진짜로 0원이다.
    expect(formatPrice(0)).toBe('0원')
  })

  it('가격이 없으면 null을 준다', () => {
    expect(formatPrice(null)).toBeNull()
  })
})

describe('formatDate', () => {
  it('앞의 0을 어색하게 벗기지 않고 달력 날짜를 만든다', () => {
    expect(formatDate('2025-11-02')).toBe('2025. 11. 2.')
    expect(formatDate('2026-01-15')).toBe('2026. 1. 15.')
  })

  it('음수 오프셋 타임존에서 날이 밀리지 않는다', () => {
    // 이것이 지키는 회귀는 UTC 서쪽에서만 나타난다 — `new Date('2025-11-02')`는 UTC
    // 자정이고 거기서는 1일로 그려진다. 호스트 타임존으로 돌리면 KST 기계에서는 어떤
    // 구현이든 통과하므로, 이 단언만 프로세스 타임존을 고정한다.
    // 이 한 줄 때문에 앱 tsconfig가 node 타입을 받지 않도록 globalThis로 닿는다.
    const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
      ?.env
    const original = env?.TZ
    if (env) env.TZ = 'America/New_York'
    try {
      // 먼저 자기 검사. TZ 변경이 먹히지 않게 되면(워커 격리 모드가 다르거나 Node가
      // 바뀌거나) 아래 단언이 틀린 이유로 통과해 이 가드가 조용히 항진명제가 된다.
      // 이 줄은 옛 구현이 무엇을 했는지도 기록한다.
      expect(new Date('2025-11-02').toLocaleDateString('ko-KR')).toBe('2025. 11. 1.')
      expect(formatDate('2025-11-02')).toBe('2025. 11. 2.')
    } finally {
      if (env) env.TZ = original
    }
  })

  it('비었거나 형식이 어긋난 입력에는 null을 준다', () => {
    expect(formatDate(null)).toBeNull()
    expect(formatDate('')).toBeNull()
    expect(formatDate('2025-11-02T00:00:00Z')).toBeNull()
    expect(formatDate('어제')).toBeNull()
  })
})

describe('formatMonthDay', () => {
  it('연도와 0 채움을 뺀다', () => {
    // `8.14 (어제)` 안에 들어가고, 옆의 말이 어느 14일인지를 말한다 — 그래서
    // `formatDate`가 지키는 부분은 컨트롤 위에서 소음일 뿐이다.
    expect(formatMonthDay('2026-08-14')).toBe('8.14')
    expect(formatMonthDay('2026-01-05')).toBe('1.5')
  })

  it('달력 날짜가 아니면 null이다', () => {
    expect(formatMonthDay('2026-02-30')).toBeNull()
    expect(formatMonthDay('어제')).toBeNull()
  })
})

describe('formatDayAgo', () => {
  const today = '2026-08-15'

  it('이름이 있는 두 날은 이름으로 부른다', () => {
    expect(formatDayAgo('2026-08-15', today)).toBe('오늘')
    expect(formatDayAgo('2026-08-14', today)).toBe('어제')
  })

  it('답이 덜 정밀해질수록 단위를 넓힌다', () => {
    // 5일 전은 대응할 수 있는 것이고 142일 전은 아무도 환산하지 않는 숫자다.
    // 카드에는 둘 중 하나가 들어갈 자리밖에 없다.
    expect(formatDayAgo('2026-08-10', today)).toBe('5일 전')
    expect(formatDayAgo('2026-08-01', today)).toBe('2주 전')
    expect(formatDayAgo('2026-06-15', today)).toBe('2개월 전')
    expect(formatDayAgo('2025-08-15', today)).toBe('1년 전')
  })

  it('never says 0개월 전', () => {
    // 4주가 달력상 한 달도 아닐 수 있고, 거기서 바닥값이
    // 개월 가지의 1이 제 몫을 한다.
    expect(formatDayAgo('2026-01-03', '2026-01-31')).toBe('1개월 전')
  })

  it('1년을 12개월이 아니라 년으로 읽는다', () => {
    // 360일은 `days / 30`으로 12개월이고, 그것이 이 함수가 일부러 쓰지 않는 산술이다.
    expect(formatDayAgo('2025-08-20', today)).toBe('11개월 전')
    expect(formatDayAgo('2025-08-14', today)).toBe('1년 전')
  })

  it('미래의 날은 음수가 아니라 오늘로 부른다', () => {
    // DB는 서버보다 하루 앞선 착용 기록을 받아준다 — 그 허용치는 여유가 아니라
    // 타임존이다 — 그래서 동쪽으로 옮겨간 폰에서 닿을 수 있고, "-1일 전"은 카드에
    // 올릴 만한 말이 아니다.
    expect(formatDayAgo('2026-08-16', today)).toBe('오늘')
  })

  it('어느 한쪽이라도 형식이 어긋나면 null이다', () => {
    expect(formatDayAgo('어제', today)).toBeNull()
    expect(formatDayAgo(today, '')).toBeNull()
  })
})
