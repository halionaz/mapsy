import { describe, expect, it } from 'vitest'
import { DB_CONSTRAINTS } from '@/shared/config/dbConstraints.generated'
import { errorMessage, MAPPED_CONSTRAINTS } from './errorMessage'

describe('errorMessage', () => {
  it('reads a Supabase error, which is a plain object rather than an Error', () => {
    // This is the shape supabase-js returns on the non-throwOnError path.
    // `instanceof Error` is false for it, so String() rendered "[object Object]".
    // Deliberately a message with no constraint mapping, so this asserts the
    // plain-object read rather than the translation table.
    const supabaseError = {
      message: 'TypeError: Failed to fetch',
      details: null,
      hint: null,
      code: '',
    }
    expect(errorMessage(supabaseError)).toBe('TypeError: Failed to fetch')
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

describe('errorMessage — 제약 위반', () => {
  it('translates a constraint name into something actionable', () => {
    expect(
      errorMessage({
        message: 'new row for relation "items" violates check constraint "items_memo_length"',
        code: '23514',
      }),
    ).toBe('메모가 너무 길어요.')
  })

  it('falls back to the SQLSTATE when the constraint is unknown', () => {
    expect(errorMessage({ message: 'value out of range', code: '22003' })).toBe(
      '숫자가 너무 커요.',
    )
  })

  it('translates a NOT NULL violation, which names no constraint', () => {
    // Verbatim from Postgres 17. NOT NULL is not a `pg_constraint` row there, so
    // it is absent from the generated inventory and from CONSTRAINT_MESSAGES,
    // and the message quotes the column rather than a constraint — no lookup
    // above can reach it. SQLSTATE is the only handle.
    expect(
      errorMessage({
        message:
          'null value in column "title" of relation "items" violates not-null constraint',
        code: '23502',
      }),
    ).toBe('필수 항목이 비어 있어요.')
  })

  it('keeps the original text when nothing matches', () => {
    expect(errorMessage({ message: 'connection reset', code: 'XX000' })).toBe('connection reset')
  })

  it('matches the whole constraint name, not a prefix of it', () => {
    // The map is generated and only grows. A substring scan would return the
    // message for `items_price_max` here purely because it comes first in
    // insertion order, so the name is extracted and looked up exactly.
    expect(
      errorMessage({
        message: 'violates check constraint "items_price_max_krw"',
        code: '23514',
      }),
    ).toBe('violates check constraint "items_price_max_krw"')
  })
})

describe('errorMessage — 빈 메시지', () => {
  it('falls back for an Error with no message', () => {
    // The object branch catches every Error (message is an own property), so
    // this reaches the instanceof branch with an empty string — which used to be
    // returned verbatim, rendering a label followed by nothing.
    expect(errorMessage(new Error(''))).toBe('알 수 없는 오류')
    expect(errorMessage(new Error(''), '잠시 후 다시')).toBe('잠시 후 다시')
  })

  it('maps the price ceiling', () => {
    expect(
      errorMessage({
        message: 'violates check constraint "items_price_max"',
        code: '23514',
      }),
    ).toBe('가격이 너무 커요.')
  })
})

describe('CONSTRAINT_MESSAGES 커버리지', () => {
  it('covers every constraint the schema defines', () => {
    // The map claimed completeness in a comment three times and drifted three
    // times. The inventory is now generated from the database by `pnpm test:db`,
    // so adding a constraint without a message fails here instead of surfacing
    // as raw Postgres text on a Korean screen.
    const missing = DB_CONSTRAINTS.filter((name) => !MAPPED_CONSTRAINTS.includes(name))
    expect(missing).toEqual([])
  })

  it('has no messages for constraints that no longer exist', () => {
    const stale = MAPPED_CONSTRAINTS.filter(
      (name) => !(DB_CONSTRAINTS as readonly string[]).includes(name),
    )
    expect(stale).toEqual([])
  })
})
