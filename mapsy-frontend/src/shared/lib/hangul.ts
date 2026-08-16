/**
 * 초성 검색.
 *
 * 폰에서 "ㄴㅍㅅ"는 "노스페이스"보다 훨씬 적은 일이고, 옷장은 그 앞에 선 채로 계속
 * 검색된다. 클라이언트에서 하는 것은 컬렉션을 통째로 미리 불러오는 결정(PRD §8.4)의
 * 일부다 — 같은 매칭을 Postgres에서 하려면 생성 컬럼과 trigram 인덱스가 필요하다.
 */

const HANGUL_BASE = 0xac00 // '가'
const HANGUL_LAST = 0xd7a3 // '힣'

// 인덱스가 유니코드 한글 음절 블록의 조합 순서와 맞는다.
const CHOSEONG = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
]

const JUNGSEONG_COUNT = 21
const JONGSEONG_COUNT = 28

/** 조합된 음절의 초성. 음절이 아니면 글자 그대로. */
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

/** `query`가 전부 낱자 초성인지. */
function isInitialsQuery(query: string): boolean {
  const compact = stripSpaces(query)
  return compact.length > 0 && [...compact].every((c) => CHOSEONG.includes(c))
}

/**
 * `query`를 `text`에 맞춰본다. 대소문자는 가리지 않는다.
 *
 * 전부 초성 낱자인 질의만 초성끼리 비교하고, 나머지는 평범한 부분 문자열 비교다.
 * 그 제한이 "니트"가 모든 ㄴ-ㅌ 단어에 걸리는 것을 막는다 — 음절을 쳤다면 그대로를
 * 뜻한 것이다.
 */
export function matchesQuery(text: string, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  const haystack = text.toLowerCase()
  if (haystack.includes(needle)) return true

  if (isInitialsQuery(needle)) {
    // 양쪽 모두 공백을 버린다 — 초성을 칠 때 띄어쓰기를 하는 사람은 없으므로
    // "ㅅㅈㅋ"가 단어 경계를 넘어 "노스페이스 자켓"을 찾아야 한다.
    return stripSpaces(toInitials(haystack)).includes(stripSpaces(needle))
  }

  return false
}
