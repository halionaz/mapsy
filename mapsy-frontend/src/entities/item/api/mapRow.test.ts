import { describe, expect, it } from 'vitest'
import type { ProcessedPhoto } from '@/shared/lib/image'
import type { PhotoEntry } from '../model/photoEntries'
import type { ItemImage } from '../model/types'
import {
  toImagePayload,
  toItem,
  toItemInsert,
  toItemUpdate,
  uniqueTags,
  type ItemRow,
} from './mapRow'

const baseRow: ItemRow = {
  id: 'i1',
  user_id: 'u1',
  title: '마산 플리스',
  category_id: 'outer.fleece',
  brand: '파타고니아',
  size: 'M',
  fit: '레귤러',
  colors: ['navy', 'white'],
  seasons: ['fall', 'winter'],
  price: 220000,
  purchased_at: '2025-11-02',
  purchase_place: '무신사',
  memo: null,
  tags: ['출근용'],
  status: 'owned',
  is_favorite: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('toItem', () => {
  it('snake_case 컬럼을 도메인 모양으로 옮긴다', () => {
    const item = toItem(baseRow)
    expect(item.categoryId).toBe('outer.fleece')
    expect(item.purchasePlace).toBe('무신사')
    expect(item.isFavorite).toBe(false)
  })

  it('팔레트에 없는 색을 버린다', () => {
    // 더 넓은 팔레트를 가진 빌드가 쓴 행이 모르는 id를 ColorId로 밀입국시키면 안 된다.
    const item = toItem({ ...baseRow, colors: ['navy', 'ivory', 'white'] })
    expect(item.colors).toEqual(['navy', 'white'])
  })

  it('모르는 계절을 버린다', () => {
    const item = toItem({ ...baseRow, seasons: ['fall', 'monsoon'] })
    expect(item.seasons).toEqual(['fall'])
  })

  it('빈 배열을 다룬다', () => {
    // null 배열이 아니다 — colors·seasons·tags가 `not null default '{}'`이고 생성된
    // 행 타입도 그것을 그대로 싣는다.
    const item = toItem({ ...baseRow, colors: [], seasons: [], tags: [] })
    expect(item.colors).toEqual([])
    expect(item.seasons).toEqual([])
    expect(item.tags).toEqual([])
  })

  it('모르는 상태는 보유로 떨어진다', () => {
    // 아직 가진 것을 감추는 쪽이 그 반대보다 나쁘다.
    expect(toItem({ ...baseRow, status: 'archived' }).status).toBe('owned')
    expect(toItem({ ...baseRow, status: 'disposed' }).status).toBe('disposed')
  })

  it('없앤 소분류를 버리지 않고 기타로 돌린다', () => {
    // DB는 대분류 접두사만 검증하므로 이 행은 합법이다.
    expect(toItem({ ...baseRow, category_id: 'outer.poncho' }).categoryId).toBe('etc.etc')
  })
})

describe('toItemInsert', () => {
  it('이름을 다듬고 소유자를 찍는다', () => {
    const payload = toItemInsert({ title: '  후드  ', categoryId: 'top.sweatshirt' }, 'u9')
    expect(payload.title).toBe('후드')
    expect(payload.user_id).toBe('u9')
  })

  it('비어 있는 선택 텍스트를 null로 정규화한다', () => {
    // "브랜드 없음"의 표현이 둘이 아니라 하나여야 한다.
    const payload = toItemInsert(
      { title: '후드', categoryId: 'top.sweatshirt', brand: '   ', memo: '' },
      'u9',
    )
    expect(payload.brand).toBeNull()
    expect(payload.memo).toBeNull()
  })

  it('없는 컬렉션은 undefined를 보내지 않고 기본값으로 채운다', () => {
    const payload = toItemInsert({ title: '후드', categoryId: 'top.sweatshirt' }, 'u9')
    expect(payload.colors).toEqual([])
    expect(payload.seasons).toEqual([])
    expect(payload.tags).toEqual([])
    expect(payload.is_favorite).toBe(false)
  })

  it('0원을 null로 만들지 않고 그대로 둔다', () => {
    // 공짜 옷은 실재한다 — 선물이거나 물려받은 것.
    const payload = toItemInsert({ title: '선물', categoryId: 'top.knit', price: 0 }, 'u9')
    expect(payload.price).toBe(0)
  })
})

describe('toItemUpdate', () => {
  it('소유가 재지정될 수 없도록 user_id를 뺀다', () => {
    // 보내봐야 잘해야 무효고 잘못하면 RLS 검사에 걸린다.
    const payload = toItemUpdate({ title: '후드', categoryId: 'top.sweatshirt' })
    expect(payload).not.toHaveProperty('user_id')
  })

  it('편집 가능한 컬럼은 그대로 쓴다', () => {
    const payload = toItemUpdate({
      title: '후드',
      categoryId: 'top.sweatshirt',
      brand: '무신사',
      price: 39000,
    })
    expect(payload.brand).toBe('무신사')
    expect(payload.price).toBe(39000)
  })
})

describe('toImagePayload', () => {
  const uploaded = [
    { id: 'new1', path: 'p/new1.webp', thumb_path: 'p/new1_thumb.webp', width: 1, height: 1 },
    { id: 'new2', path: 'p/new2.webp', thumb_path: 'p/new2_thumb.webp', width: 2, height: 2 },
  ]

  function stored(id: string): PhotoEntry {
    return { kind: 'stored', image: { id } as ItemImage }
  }

  function picked(previewUrl: string): PhotoEntry {
    return { kind: 'picked', photo: { previewUrl } as ProcessedPhoto }
  }

  it('폼 순서를 지키고 고른 항목마다 자기 업로드를 건넨다', () => {
    // 이 배열의 위치가 *곧* 함수가 쓰는 sort_order라, 맞는 행을 틀린 순서로 실은
    // payload는 아무도 고르지 않은 순서로 사진을 저장한다 — 그리고 아무것도 실패하지 않는다.
    const payload = toImagePayload(
      [picked('blob:a'), stored('old1'), picked('blob:b'), stored('old2')],
      uploaded,
    )

    expect(payload).toEqual([uploaded[0], { id: 'old1' }, uploaded[1], { id: 'old2' }])
  })

  it('저장본은 id만 보낸다 — 행을 다시 쓸 수 있는 것은 아무것도', () => {
    expect(toImagePayload([stored('old1')], [])).toEqual([{ id: 'old1' }])
  })
})

describe('uniqueTags', () => {
  it('앞의 #과 둘레 공백을 벗긴다', () => {
    expect(uniqueTags([' #출근용 ', '러닝'])).toEqual(['출근용', '러닝'])
  })

  it('정규화한 뒤 중복을 없앤다', () => {
    expect(uniqueTags(['출근용', '#출근용', ' 출근용'])).toEqual(['출근용'])
  })

  it('빈 것을 버린다', () => {
    expect(uniqueTags(['', '  ', '#'])).toEqual([])
  })

  it('입력 순서를 지킨다', () => {
    expect(uniqueTags(['b', 'a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
  })
})
