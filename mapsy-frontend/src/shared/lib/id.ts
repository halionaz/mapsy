/**
 * UUID v4, with a fallback for insecure contexts.
 *
 * `crypto.randomUUID` only exists in a secure context, which `localhost` is but
 * `http://192.168.x.x:5173` is not — exactly how you test on a real phone over
 * the LAN. Without the fallback, registration dies with a TypeError on the one
 * device the app is actually designed for.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // getRandomValues is available in insecure contexts; only randomUUID is not.
  // The guard above already established that `crypto` exists at all, but re-read
  // it through a local so this branch cannot throw ReferenceError if it doesn't.
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
