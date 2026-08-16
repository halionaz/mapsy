import { describe, expect, it } from 'vitest'

import type { ProcessedPhoto } from '@/shared/lib/image'
import { samePhotoList, storedPhotoEntries, type PhotoEntry } from './photoEntries'
import type { ItemImage } from './types'

/**
 * 저장 경로가 무언가를 다시 쓰기 전에 던지는 질문.
 *
 * 틀린 답 둘 다 조용하다. 순서가 움직였는데 "같다"고 하면 편집이 저장했어요 토스트
 * 아래에서 버려지고, 안 움직였는데 "다르다"고 하면 텍스트만 고친 저장이 사진 목록을
 * 다시 쓴다 — 재작성은 델타가 아니라 목록 전체라, 화면이 열린 사이 다른 기기가 더한
 * 것을 지운다.
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
  it('폼이 열릴 때의 목록에 대해 참이다', () => {
    expect(samePhotoList(opened, [...opened])).toBe(true)
  })

  it('사진을 비교하지, 그것을 담은 객체를 비교하지 않는다', () => {
    // 옷장은 창 포커스에 다시 불러오므로 같은 사진이 새 행 객체로 온다. identity로
    // 비교하면 그것을 편집으로 읽고 목록을 다시 쓴다 — 이 함수가 피하려는 실패 전부다.
    const refetched = storedPhotoEntries([image('a', 0), image('b', 1), image('c', 2)])
    expect(samePhotoList(opened, refetched)).toBe(true)
  })

  it('사진 둘이 자리를 바꾸면 거짓이다', () => {
    expect(samePhotoList(opened, [opened[1], opened[0], opened[2]])).toBe(false)
  })

  it('사진 하나가 빠지면 거짓이다', () => {
    expect(samePhotoList(opened, opened.slice(0, 2))).toBe(false)
  })

  it('사진 하나가 더해지면 거짓이다', () => {
    expect(samePhotoList(opened, [...opened, picked('blob:new')])).toBe(false)
  })

  it('사진 하나가 새것으로 바뀌면 거짓이다 — 개수는 같고 목록은 다르다', () => {
    expect(samePhotoList(opened, [opened[0], picked('blob:x'), picked('blob:y')])).toBe(false)
  })
})

describe('storedPhotoEntries', () => {
  it('행이 어떤 순서로 왔든 커버를 맨 앞에 놓는다', () => {
    const shuffled = [image('c', 2), image('a', 0), image('b', 1)]
    expect(storedPhotoEntries(shuffled).map((entry) => photoIdOf(entry))).toEqual(['a', 'b', 'c'])
  })
})

function photoIdOf(entry: PhotoEntry): string {
  return entry.kind === 'stored' ? entry.image.id : entry.photo.previewUrl
}
