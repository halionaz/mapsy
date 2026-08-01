import { describe, expect, it } from 'vitest'
import { toItem, toItemPayload, uniqueTags, type ItemRow } from './mapRow'

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
  it('maps snake_case columns onto the domain shape', () => {
    const item = toItem(baseRow)
    expect(item.categoryId).toBe('outer.fleece')
    expect(item.purchasePlace).toBe('무신사')
    expect(item.isFavorite).toBe(false)
  })

  it('drops colours that are not in the palette', () => {
    // A row written by a build with a wider palette must not smuggle an
    // unknown id into ColorId.
    const item = toItem({ ...baseRow, colors: ['navy', 'ivory', 'white'] })
    expect(item.colors).toEqual(['navy', 'white'])
  })

  it('drops unknown seasons', () => {
    const item = toItem({ ...baseRow, seasons: ['fall', 'monsoon'] })
    expect(item.seasons).toEqual(['fall'])
  })

  it('treats null arrays as empty', () => {
    const item = toItem({ ...baseRow, colors: null, seasons: null, tags: null })
    expect(item.colors).toEqual([])
    expect(item.seasons).toEqual([])
    expect(item.tags).toEqual([])
  })

  it('falls back to owned for an unrecognised status', () => {
    // Hiding something the user still owns is worse than the reverse.
    expect(toItem({ ...baseRow, status: 'archived' }).status).toBe('owned')
    expect(toItem({ ...baseRow, status: 'disposed' }).status).toBe('disposed')
  })

  it('reroutes a retired subcategory to 기타 instead of dropping it', () => {
    // The database only validates the group prefix, so this row is legal.
    expect(toItem({ ...baseRow, category_id: 'outer.poncho' }).categoryId).toBe('etc.etc')
  })
})

describe('toItemPayload', () => {
  it('trims the title and stamps the owner', () => {
    const payload = toItemPayload({ title: '  후드  ', categoryId: 'top.sweatshirt' }, 'u9')
    expect(payload.title).toBe('후드')
    expect(payload.user_id).toBe('u9')
  })

  it('normalises blank optional text to null', () => {
    // "no brand" must have one representation, not two.
    const payload = toItemPayload(
      { title: '후드', categoryId: 'top.sweatshirt', brand: '   ', memo: '' },
      'u9',
    )
    expect(payload.brand).toBeNull()
    expect(payload.memo).toBeNull()
  })

  it('defaults absent collections rather than sending undefined', () => {
    const payload = toItemPayload({ title: '후드', categoryId: 'top.sweatshirt' }, 'u9')
    expect(payload.colors).toEqual([])
    expect(payload.seasons).toEqual([])
    expect(payload.tags).toEqual([])
    expect(payload.is_favorite).toBe(false)
  })

  it('keeps a zero price instead of nulling it', () => {
    // Free garments are real — a gift or a hand-me-down.
    const payload = toItemPayload(
      { title: '선물', categoryId: 'top.knit', price: 0 },
      'u9',
    )
    expect(payload.price).toBe(0)
  })
})

describe('uniqueTags', () => {
  it('strips a leading hash and surrounding space', () => {
    expect(uniqueTags([' #출근용 ', '러닝'])).toEqual(['출근용', '러닝'])
  })

  it('de-duplicates after normalising', () => {
    expect(uniqueTags(['출근용', '#출근용', ' 출근용'])).toEqual(['출근용'])
  })

  it('drops empties', () => {
    expect(uniqueTags(['', '  ', '#'])).toEqual([])
  })

  it('preserves input order', () => {
    expect(uniqueTags(['b', 'a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
  })
})
