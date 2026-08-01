/**
 * Human-readable text for anything thrown by the data layer.
 *
 * Supabase's query results carry a plain `{ message, details, hint, code }`
 * object rather than an Error — the client only constructs `PostgrestError` on
 * the `throwOnError` path, which this app does not use. So `instanceof Error`
 * is false and `String(error)` renders "[object Object]", which is what the
 * wardrobe's failure card was showing instead of a reason.
 */
export function errorMessage(error: unknown, fallback = '알 수 없는 오류'): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message

  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message?: unknown }
    if (typeof message === 'string' && message.trim()) return message
  }

  return fallback
}
