/**
 * 옷장의 캐시 키 — 옷 엔티티가 가진 하나뿐인 컬렉션 쿼리.
 *
 * 공용 레지스트리가 아니라 엔티티 안에 있다. 키는 캐시 엔트리의 *주소*이고, 주소는
 * 그것을 채우는 것 옆에 있어야 한다.
 *
 * 모양이 둘이고 차이가 중요하다.
 *
 * - `all`은 **접두사**다. react-query가 `cancelQueries`와 `invalidateQueries`를
 *   접두사로 맞추므로, 나중에 추가될 옷장 쿼리까지 닿는다.
 * - `list()`는 **정확한** 키다. `setQueryData`·`getQueryData`는 접두사로 맞추지 않고
 *   엔트리 하나를 가리키므로 반드시 이쪽을 거쳐야 한다.
 */

const ROOT = ['wardrobe'] as const

export const wardrobeKeys = {
  all: ROOT,
  /** 컬렉션 전체 — 엔트리 하나, 클라이언트에서 거른다 (PRD §8.4). */
  list: () => [...ROOT, 'list'] as const,
} as const
