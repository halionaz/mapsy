import { describe, expect, it } from 'vitest'

import { photoSlots } from './photoSlots'

const PHOTOS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const URLS = ['url-a', 'url-b', 'url-c']

describe('photoSlots', () => {
  it('waits rather than failing while nothing has been signed', () => {
    expect(photoSlots(PHOTOS, null).map((slot) => slot.state)).toEqual([
      'pending',
      'pending',
      'pending',
    ])
  })

  it('waits when the answer describes a different number of photos', () => {
    // The cold-load path exactly: the effect answered `[]` for an item that had
    // not arrived yet, and the photos landed a render before the re-signing did.
    expect(photoSlots(PHOTOS, []).map((slot) => slot.state)).toEqual([
      'pending',
      'pending',
      'pending',
    ])
  })

  it('pairs settled URLs with their photos in order', () => {
    expect(photoSlots(PHOTOS, URLS)).toEqual([
      { id: 'a', url: 'url-a', state: 'ready' },
      { id: 'b', url: 'url-b', state: 'ready' },
      { id: 'c', url: 'url-c', state: 'ready' },
    ])
  })

  it('fails only the photo whose URL could not be signed', () => {
    expect(photoSlots(PHOTOS, ['url-a', null, 'url-c']).map((slot) => slot.state)).toEqual([
      'ready',
      'failed',
      'ready',
    ])
  })

  it('fails a photo that was signed but would not load', () => {
    const slots = photoSlots(PHOTOS, URLS, new Set(['b']))
    expect(slots.map((slot) => slot.state)).toEqual(['ready', 'failed', 'ready'])
    // Nothing openable is left behind on a failed slot.
    expect(slots[1].url).toBeNull()
  })

  it('never hands back a URL for a slot that is not ready', () => {
    const slots = photoSlots(PHOTOS, ['url-a', null, 'url-c'], new Set(['c']))
    for (const slot of slots) {
      expect(slot.url == null).toBe(slot.state !== 'ready')
    }
  })

  it('has nothing to say about an item with no photos', () => {
    expect(photoSlots([], [])).toEqual([])
    expect(photoSlots([], null)).toEqual([])
  })
})
