import { describe, expect, it } from 'vitest'
import { matchesQuery, toInitials } from './hangul'

describe('toInitials', () => {
  it('extracts 초성 from composed syllables', () => {
    expect(toInitials('노스페이스')).toBe('ㄴㅅㅍㅇㅅ')
    expect(toInitials('자켓')).toBe('ㅈㅋ')
  })

  it('handles syllables with and without a final consonant', () => {
    // 가 has no 받침, 각 does — both must resolve to the same initial.
    expect(toInitials('가각')).toBe('ㄱㄱ')
  })

  it('covers the ends of the syllable block', () => {
    expect(toInitials('가')).toBe('ㄱ')
    expect(toInitials('힣')).toBe('ㅎ')
  })

  it('passes non-Hangul through untouched', () => {
    expect(toInitials('Nike 95')).toBe('Nike 95')
    expect(toInitials('니트 knit')).toBe('ㄴㅌ knit')
  })
})

describe('matchesQuery', () => {
  it('matches plain substrings', () => {
    expect(matchesQuery('노스페이스 자켓', '페이스')).toBe(true)
    expect(matchesQuery('노스페이스 자켓', '아디다스')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(matchesQuery('Nike Air Max', 'nike')).toBe(true)
    expect(matchesQuery('nike air max', 'AIR')).toBe(true)
  })

  it('matches 초성 queries', () => {
    expect(matchesQuery('노스페이스 자켓', 'ㄴㅅㅍ')).toBe(true)
    expect(matchesQuery('노스페이스 자켓', 'ㅈㅋ')).toBe(true)
    expect(matchesQuery('노스페이스 자켓', 'ㄱㄴㄷ')).toBe(false)
  })

  it('ignores spaces in a 초성 query', () => {
    expect(matchesQuery('노스페이스 자켓', 'ㅅㅈㅋ')).toBe(true)
  })

  it('does not treat a query with real syllables as 초성', () => {
    // '니트' would match as ㄴ-ㅌ initials against 나트 / 노트 / 누텔라 etc.
    // Once the user types syllables they mean them literally.
    expect(matchesQuery('나트랑 기념품', '니트')).toBe(false)
  })

  it('treats an empty query as matching everything', () => {
    expect(matchesQuery('아무거나', '')).toBe(true)
    expect(matchesQuery('아무거나', '   ')).toBe(true)
  })
})
