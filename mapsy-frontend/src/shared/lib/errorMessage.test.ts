import { describe, expect, it } from 'vitest'
import { DB_CONSTRAINTS } from '@/shared/config/dbConstraints.generated'
import { errorMessage, MAPPED_CONSTRAINTS } from './errorMessage'

describe('errorMessage', () => {
  it('Error가 아니라 평범한 객체인 Supabase 에러를 읽는다', () => {
    // supabase-js가 throwOnError가 아닌 경로에서 돌려주는 모양이다.
    // `instanceof Error`가 거짓이라 String()은 "[object Object]"를 그렸다.
    // 일부러 제약 매핑이 없는 메시지를 써서, 번역표가 아니라 객체 읽기를 검사한다.
    const supabaseError = {
      message: 'TypeError: Failed to fetch',
      details: null,
      hint: null,
      code: '',
    }
    expect(errorMessage(supabaseError)).toBe('TypeError: Failed to fetch')
  })

  it('진짜 Error를 읽는다', () => {
    expect(errorMessage(new Error('네트워크 실패'))).toBe('네트워크 실패')
  })

  it('문자열은 그대로 흘려보낸다', () => {
    expect(errorMessage('그냥 문자열')).toBe('그냥 문자열')
  })

  it('읽을 수 없는 모양에는 대체 문구를 쓴다', () => {
    expect(errorMessage(null)).toBe('알 수 없는 오류')
    expect(errorMessage(undefined)).toBe('알 수 없는 오류')
    expect(errorMessage({ code: 500 })).toBe('알 수 없는 오류')
    expect(errorMessage({ message: '   ' })).toBe('알 수 없는 오류')
  })

  it('호출부가 준 대체 문구를 쓴다', () => {
    expect(errorMessage(null, '잠시 후 다시')).toBe('잠시 후 다시')
  })
})

describe('errorMessage — 제약 위반', () => {
  it('제약 이름을 대응할 수 있는 말로 옮긴다', () => {
    expect(
      errorMessage({
        message: 'new row for relation "items" violates check constraint "items_memo_length"',
        code: '23514',
      }),
    ).toBe('메모가 너무 길어요.')
  })

  it('모르는 제약이면 SQLSTATE로 떨어진다', () => {
    expect(errorMessage({ message: 'value out of range', code: '22003' })).toBe('숫자가 너무 커요.')
  })

  it('제약 이름이 없는 NOT NULL 위반을 옮긴다', () => {
    // Postgres 17의 문구 그대로. NOT NULL은 거기서 `pg_constraint` 행이 아니라 생성된
    // 목록에도 CONSTRAINT_MESSAGES에도 없고, 메시지가 제약이 아니라 컬럼을 인용한다 —
    // 위의 어떤 조회도 닿지 못한다. 손잡이는 SQLSTATE뿐이다.
    expect(
      errorMessage({
        message: 'null value in column "title" of relation "items" violates not-null constraint',
        code: '23502',
      }),
    ).toBe('필수 항목이 비어 있어요.')
  })

  it('아무것도 맞지 않으면 원문을 유지한다', () => {
    expect(errorMessage({ message: 'connection reset', code: 'XX000' })).toBe('connection reset')
  })

  it('제약 이름의 접두사가 아니라 전체를 맞춘다', () => {
    // 표는 생성되고 늘기만 한다. 부분 문자열 훑기는 삽입 순서가 앞선다는 이유만으로
    // `items_price_max`의 문구를 돌려주므로, 이름을 뽑아 정확히 찾는다.
    expect(
      errorMessage({
        message: 'violates check constraint "items_price_max_krw"',
        code: '23514',
      }),
    ).toBe('violates check constraint "items_price_max_krw"')
  })
})

describe('errorMessage — 빈 메시지', () => {
  it('메시지 없는 Error에는 대체 문구를 쓴다', () => {
    // 객체 가지가 모든 Error를 잡으므로(message가 own property다) 여기 닿는 것은 빈
    // 문자열이고, 예전에는 그대로 반환되어 라벨 뒤에 아무것도 없는 화면이 됐다.
    expect(errorMessage(new Error(''))).toBe('알 수 없는 오류')
    expect(errorMessage(new Error(''), '잠시 후 다시')).toBe('잠시 후 다시')
  })

  it('가격 상한을 옮긴다', () => {
    expect(
      errorMessage({
        message: 'violates check constraint "items_price_max"',
        code: '23514',
      }),
    ).toBe('가격이 너무 커요.')
  })
})

describe('CONSTRAINT_MESSAGES 커버리지', () => {
  it('스키마가 정의한 모든 제약을 덮는다', () => {
    // 표는 주석으로 완전하다고 세 번 주장했고 세 번 어긋났다. 목록은 이제 `pnpm test:db`가
    // DB에서 생성하므로, 문구 없이 제약을 더하면 한국어 화면에 원시 Postgres 문구가
    // 뜨는 대신 여기서 깨진다.
    const missing = DB_CONSTRAINTS.filter((name) => !MAPPED_CONSTRAINTS.includes(name))
    expect(missing).toEqual([])
  })

  it('더는 없는 제약에 대한 문구를 남기지 않는다', () => {
    const stale = MAPPED_CONSTRAINTS.filter(
      (name) => !(DB_CONSTRAINTS as readonly string[]).includes(name),
    )
    expect(stale).toEqual([])
  })
})
