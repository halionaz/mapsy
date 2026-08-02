/**
 * Korean initial-consonant (초성) search.
 *
 * On a phone, typing "ㄴㅍㅅ" is far less work than "노스페이스", and a wardrobe
 * is searched constantly while standing in front of it. Doing this on the client
 * is also why the whole collection is loaded up front (PRD §8.4) — the same
 * matching in Postgres would need a generated column and a trigram index.
 */

const HANGUL_BASE = 0xac00 // '가'
const HANGUL_LAST = 0xd7a3 // '힣'

// Index matches the composition order of the Unicode Hangul syllable block.
const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

const JUNGSEONG_COUNT = 21
const JONGSEONG_COUNT = 28

/** The 초성 of a composed syllable, or the character itself if it isn't one. */
function initialOf(char: string): string {
  const code = char.charCodeAt(0)
  if (code < HANGUL_BASE || code > HANGUL_LAST) return char
  const index = Math.floor((code - HANGUL_BASE) / (JUNGSEONG_COUNT * JONGSEONG_COUNT))
  return CHOSEONG[index]
}

/** "노스페이스 자켓" → "ㄴㅅㅍㅇㅅ ㅈㅋ" */
export function toInitials(text: string): string {
  let out = ''
  for (const char of text) out += initialOf(char)
  return out
}

function stripSpaces(text: string): string {
  return text.replace(/\s/g, '')
}

/** True when every character of `query` is a bare 초성 jamo. */
function isInitialsQuery(query: string): boolean {
  const compact = stripSpaces(query)
  return compact.length > 0 && [...compact].every((c) => CHOSEONG.includes(c))
}

/**
 * Matches `query` against `text`, case-insensitively.
 *
 * A query made entirely of 초성 jamo is matched against the text's initials;
 * anything else is a plain substring match. Restricting initials matching to
 * jamo-only queries keeps "니트" from matching every ㄴ-ㅌ word — once the user
 * has typed real syllables they mean them literally.
 */
export function matchesQuery(text: string, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  const haystack = text.toLowerCase()
  if (haystack.includes(needle)) return true

  if (isInitialsQuery(needle)) {
    // Whitespace is dropped from both sides: nobody types the spaces when
    // entering initials, so "ㅅㅈㅋ" should still find "노스페이스 자켓" across
    // the word boundary.
    return stripSpaces(toInitials(haystack)).includes(stripSpaces(needle))
  }

  return false
}
