/**
 * 착용 기록의 캐시 키 — 옷장과 마찬가지로 컬렉션 쿼리 하나.
 *
 * `wardrobeKeys`와 별개 엔트리인 것은 의도다. 착용을 토글하는 것이 옷 캐시를 흔들면 안
 * 된다 — 그 엔트리를 다시 받으면 모든 커버 URL이 재서명되어 `<img src>`가 전부 바뀌고
 * 격자가 통째로 다시 로드된다.
 *
 * 모양이 둘인 이유는 `entities/item/model/queryKeys.ts`와 같다.
 */

const ROOT = ['wears'] as const

export const wearKeys = {
  all: ROOT,
  /** 이 사용자의 모든 착용 기록. 집계는 클라이언트에서 한다. */
  list: () => [...ROOT, 'list'] as const,
} as const
