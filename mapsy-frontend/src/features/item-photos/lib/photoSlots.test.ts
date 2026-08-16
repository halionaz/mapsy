import { describe, expect, it } from 'vitest'

import { photoSlots } from './photoSlots'

const PHOTOS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const URLS = ['url-a', 'url-b', 'url-c']

describe('photoSlots', () => {
  it('아직 서명된 것이 없으면 실패가 아니라 기다린다', () => {
    expect(photoSlots(PHOTOS, null).map((slot) => slot.state)).toEqual([
      'pending',
      'pending',
      'pending',
    ])
  })

  it('답이 다른 개수의 사진을 서술하면 기다린다', () => {
    // 정확히 콜드 로드 경로다 — effect가 아직 도착하지 않은 옷에 `[]`로 답했고,
    // 사진이 재서명보다 한 렌더 먼저 도착했다.
    expect(photoSlots(PHOTOS, []).map((slot) => slot.state)).toEqual([
      'pending',
      'pending',
      'pending',
    ])
  })

  it('정착한 URL을 자기 사진과 순서대로 짝짓는다', () => {
    expect(photoSlots(PHOTOS, URLS)).toEqual([
      { id: 'a', url: 'url-a', state: 'ready' },
      { id: 'b', url: 'url-b', state: 'ready' },
      { id: 'c', url: 'url-c', state: 'ready' },
    ])
  })

  it('URL을 서명하지 못한 사진만 실패로 만든다', () => {
    expect(photoSlots(PHOTOS, ['url-a', null, 'url-c']).map((slot) => slot.state)).toEqual([
      'ready',
      'failed',
      'ready',
    ])
  })

  it('서명은 됐지만 로드되지 않은 사진을 실패로 만든다', () => {
    const slots = photoSlots(PHOTOS, URLS, new Set(['b']))
    expect(slots.map((slot) => slot.state)).toEqual(['ready', 'failed', 'ready'])
    // 실패한 슬롯에는 열 수 있는 것이 남지 않는다.
    expect(slots[1].url).toBeNull()
  })

  it('준비되지 않은 슬롯에는 URL을 돌려주지 않는다', () => {
    const slots = photoSlots(PHOTOS, ['url-a', null, 'url-c'], new Set(['c']))
    for (const slot of slots) {
      expect(slot.url == null).toBe(slot.state !== 'ready')
    }
  })

  it('사진 없는 옷에는 할 말이 없다', () => {
    expect(photoSlots([], [])).toEqual([])
    expect(photoSlots([], null)).toEqual([])
  })
})
