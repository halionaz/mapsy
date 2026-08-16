/**
 * 인증의 캐시 키.
 *
 * 다른 슬라이스와 같은 두 모양 — `all`은 취소·무효화가 접두사로 맞추는 것이고,
 * `session()`은 `setQueryData`가 필요로 하는 정확한 키다. 인증 상태 리스너가
 * 그 정확한 키로 쓴다.
 */

const ROOT = ['auth'] as const

export const authKeys = {
  all: ROOT,
  session: () => [...ROOT, 'session'] as const,
} as const
