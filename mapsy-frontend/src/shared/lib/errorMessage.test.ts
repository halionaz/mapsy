import { describe, expect, it } from 'vitest'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
  it('reads a Supabase error, which is a plain object rather than an Error', () => {
    // This is the shape supabase-js returns on the non-throwOnError path.
    // `instanceof Error` is false for it, so String() rendered "[object Object]".
    const supabaseError = {
      message: 'new row violates check constraint "items_memo_length"',
      details: null,
      hint: null,
      code: '23514',
    }
    expect(errorMessage(supabaseError)).toContain('items_memo_length')
  })

  it('reads a real Error', () => {
    expect(errorMessage(new Error('네트워크 실패'))).toBe('네트워크 실패')
  })

  it('passes a string through', () => {
    expect(errorMessage('그냥 문자열')).toBe('그냥 문자열')
  })

  it('falls back for shapes it cannot read', () => {
    expect(errorMessage(null)).toBe('알 수 없는 오류')
    expect(errorMessage(undefined)).toBe('알 수 없는 오류')
    expect(errorMessage({ code: 500 })).toBe('알 수 없는 오류')
    expect(errorMessage({ message: '   ' })).toBe('알 수 없는 오류')
  })

  it('uses the caller-supplied fallback', () => {
    expect(errorMessage(null, '잠시 후 다시')).toBe('잠시 후 다시')
  })
})
