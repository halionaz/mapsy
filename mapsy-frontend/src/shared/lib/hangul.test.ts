import { describe, expect, it } from 'vitest'
import { matchesQuery, toInitials } from './hangul'

describe('toInitials', () => {
  it('조합된 음절에서 초성을 뽑는다', () => {
    expect(toInitials('노스페이스')).toBe('ㄴㅅㅍㅇㅅ')
    expect(toInitials('자켓')).toBe('ㅈㅋ')
  })

  it('받침이 있는 음절과 없는 음절을 모두 다룬다', () => {
    // 가에는 받침이 없고 각에는 있다 — 둘 다 같은 초성으로 풀려야 한다.
    expect(toInitials('가각')).toBe('ㄱㄱ')
  })

  it('음절 블록의 양 끝을 덮는다', () => {
    expect(toInitials('가')).toBe('ㄱ')
    expect(toInitials('힣')).toBe('ㅎ')
  })

  it('한글이 아닌 것은 그대로 흘려보낸다', () => {
    expect(toInitials('Nike 95')).toBe('Nike 95')
    expect(toInitials('니트 knit')).toBe('ㄴㅌ knit')
  })
})

describe('matchesQuery', () => {
  it('평범한 부분 문자열을 맞춘다', () => {
    expect(matchesQuery('노스페이스 자켓', '페이스')).toBe(true)
    expect(matchesQuery('노스페이스 자켓', '아디다스')).toBe(false)
  })

  it('대소문자를 가리지 않는다', () => {
    expect(matchesQuery('Nike Air Max', 'nike')).toBe(true)
    expect(matchesQuery('nike air max', 'AIR')).toBe(true)
  })

  it('matches 초성 queries', () => {
    expect(matchesQuery('노스페이스 자켓', 'ㄴㅅㅍ')).toBe(true)
    expect(matchesQuery('노스페이스 자켓', 'ㅈㅋ')).toBe(true)
    expect(matchesQuery('노스페이스 자켓', 'ㄱㄴㄷ')).toBe(false)
  })

  it('초성 질의의 공백을 무시한다', () => {
    expect(matchesQuery('노스페이스 자켓', 'ㅅㅈㅋ')).toBe(true)
  })

  it('실제 음절이 든 질의는 초성으로 보지 않는다', () => {
    // '니트' would match as ㄴ-ㅌ initials against 나트 / 노트 / 누텔라 etc.
    // 음절을 친 순간 그대로를 뜻한 것이다.
    expect(matchesQuery('나트랑 기념품', '니트')).toBe(false)
  })

  it('빈 질의는 전부 맞는 것으로 본다', () => {
    expect(matchesQuery('아무거나', '')).toBe(true)
    expect(matchesQuery('아무거나', '   ')).toBe(true)
  })
})
