import { describe, expect, it } from 'vitest'

import type { ProcessedPhoto } from '@/shared/lib/image'
import { samePhotoList, storedPhotoEntries, type PhotoEntry } from './photoEntries'
import type { ItemImage } from './types'

/**
 * The question the save path asks before it rewrites anything.
 *
 * Both wrong answers are silent. Say "same" when the order did move and the edit
 * is dropped under a 저장했어요 toast; say "different" when it did not and a
 * text-only save rewrites the photo list — which deletes whatever another device
 * added while the screen was open, because the rewrite is a whole list rather
 * than a delta.
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
const opened = storedPhotoEntries(images)

describe('samePhotoList', () => {
  it('is true for the list the form opened with', () => {
    expect(samePhotoList(opened, [...opened])).toBe(true)
  })

  it('compares photos, not the objects carrying them', () => {
    // The wardrobe refetches on window focus, so the same photo arrives as a new
    // row object. Comparing by identity would read that as an edit and rewrite
    // the list — which is the whole failure this function exists to avoid.
    const refetched = storedPhotoEntries([image('a', 0), image('b', 1), image('c', 2)])
    expect(samePhotoList(opened, refetched)).toBe(true)
  })

  it('is false when two photos swap places', () => {
    expect(samePhotoList(opened, [opened[1], opened[0], opened[2]])).toBe(false)
  })

  it('is false when a photo is dropped', () => {
    expect(samePhotoList(opened, opened.slice(0, 2))).toBe(false)
  })

  it('is false when a photo is added', () => {
    expect(samePhotoList(opened, [...opened, picked('blob:new')])).toBe(false)
  })

  it('is false when a photo is swapped for a new one — same count, different list', () => {
    expect(samePhotoList(opened, [opened[0], picked('blob:x'), picked('blob:y')])).toBe(false)
  })
})

describe('storedPhotoEntries', () => {
  it('puts the cover first whatever order the rows arrived in', () => {
    const shuffled = [image('c', 2), image('a', 0), image('b', 1)]
    expect(storedPhotoEntries(shuffled).map((entry) => photoIdOf(entry))).toEqual(['a', 'b', 'c'])
  })
})

function photoIdOf(entry: PhotoEntry): string {
  return entry.kind === 'stored' ? entry.image.id : entry.photo.previewUrl
}
