import { describe, expect, it } from 'vitest'

import type { ProcessedPhoto } from '@/shared/lib/image'
import { hasPhotoChanges, storedPhotoEntries, type PhotoEntry } from './photoEntries'
import type { ItemImage } from './types'

/**
 * The question the save path asks before it rewrites anything.
 *
 * Both wrong answers are silent. Say "unchanged" when the order did move and the
 * edit is dropped with a 저장했어요 toast over it; say "changed" when it did not
 * and a text-only save rewrites the photo list — which deletes whatever another
 * device added while this screen was open, because the rewrite is a whole list
 * rather than a delta.
 */

function image(id: string, sortOrder: number): ItemImage {
  return {
    id,
    itemId: 'i1',
    userId: 'u1',
    path: `${id}.webp`,
    thumbPath: `${id}_thumb.webp`,
    sortOrder,
    width: 1280,
    height: 960,
    createdAt: '2026-08-01T00:00:00Z',
  }
}

function picked(previewUrl: string): PhotoEntry {
  const blob = new Blob()
  return {
    kind: 'picked',
    photo: { full: blob, thumb: blob, width: 1, height: 1, ext: 'webp', previewUrl },
  } satisfies { kind: 'picked'; photo: ProcessedPhoto }
}

const images = [image('a', 0), image('b', 1), image('c', 2)]

describe('hasPhotoChanges', () => {
  it('is false when the form still holds exactly what the item does', () => {
    expect(hasPhotoChanges(images, storedPhotoEntries(images))).toBe(false)
  })

  it('reads the item by sort_order, not by the order the rows arrived in', () => {
    // The cache holds whatever the query returned, and a patched entry can hold
    // them in any order at all. Comparing positionally against the raw array
    // would report a reorder that nobody made.
    const shuffled = [images[2], images[0], images[1]]
    expect(hasPhotoChanges(shuffled, storedPhotoEntries(shuffled))).toBe(false)
  })

  it('is true when two photos swap places', () => {
    const entries = storedPhotoEntries(images)
    const swapped = [entries[1], entries[0], entries[2]]
    expect(hasPhotoChanges(images, swapped)).toBe(true)
  })

  it('is true when a photo is dropped', () => {
    expect(hasPhotoChanges(images, storedPhotoEntries(images).slice(0, 2))).toBe(true)
  })

  it('is true when a photo is added', () => {
    expect(hasPhotoChanges(images, [...storedPhotoEntries(images), picked('blob:new')])).toBe(true)
  })

  it('is true when a photo is swapped for a new one — same count, different list', () => {
    const [cover] = storedPhotoEntries(images)
    expect(hasPhotoChanges(images, [cover, picked('blob:x'), picked('blob:y')])).toBe(true)
  })
})
