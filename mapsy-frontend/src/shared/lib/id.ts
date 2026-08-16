/**
 * UUID v4 — 보안 컨텍스트가 아닐 때를 위한 대체 경로를 함께 둔다.
 *
 * `crypto.randomUUID`는 보안 컨텍스트에만 있고, `localhost`는 그렇지만
 * `http://192.168.x.x:5173`은 아니다 — 실제 폰에서 LAN으로 테스트하는 바로 그 경로다.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // 보안 컨텍스트가 아니어도 getRandomValues는 있다. 없는 것은 randomUUID뿐.
  const webcrypto = typeof crypto !== 'undefined' ? crypto : undefined
  if (!webcrypto?.getRandomValues) {
    throw new Error('이 브라우저에서는 안전한 id를 만들 수 없어요.')
  }

  const bytes = new Uint8Array(16)
  webcrypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
