import type { ProcessedPhoto } from '@/shared/lib/image'
import type { ItemImage } from './types'

/**
 * 폼 안의 사진 — 옷이 이미 가진 것이거나, 이번에 고른 것.
 *
 * 편집 화면은 둘을 하나의 순서 있는 목록에 섞는다. 추가·삭제·재정렬이 같은 타일 행에서
 * 일어나고, 어느 쪽이 스토리지 객체이고 어느 쪽이 아직 메모리의 blob인지는 저장할 때만
 * 의미가 있다.
 *
 * 선택적 blob을 가진 객체가 아니라 유니온인 것은, 그래야 "이미 저장됨"과 "id가 있음"이
 * 타입 검사기에게 같은 사실이 되어 아직 없는 id를 집을 수 없기 때문이다.
 */
export type PhotoEntry =
  | { kind: 'stored'; image: ItemImage }
  | { kind: 'picked'; photo: ProcessedPhoto }

/** 옷의 사진을 폼 항목으로. 커버가 먼저. */
export function storedPhotoEntries(images: readonly ItemImage[]): PhotoEntry[] {
  return [...images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((image) => ({ kind: 'stored', image }))
}

/**
 * 폼에서 사진을 식별하는 값 — React 키이자, 피커가 재정렬하는 기준이자,
 * `samePhotoList`를 통해 저장이 사진 목록을 아예 다시 쓸지 판단하는 근거다.
 *
 * 바꾸기 전에 기억할 것은 세 번째다. 렌더마다 고유한 키(새 uuid 같은)는 목록에서는
 * 멀쩡해 보이면서 모든 저장을 재작성으로 만든다 — 어떤 두 목록도 같아지지 않으므로.
 *
 * 고른 사진은 올라가기 전까지 id가 없어서 미리보기 URL이 대신한다. blob마다 다른 값을
 * 받고, 항목과 정확히 같은 수명을 산다.
 */
export function photoEntryKey(entry: PhotoEntry): string {
  return entry.kind === 'stored' ? entry.image.id : entry.photo.previewUrl
}

/**
 * 두 사진 목록이 같은 말을 하는지 — 같은 사진, 같은 순서.
 *
 * 비교 대상은 옷장 캐시가 아니라 **폼이 열릴 때의 목록**이어야 한다. 캐시는 창 포커스에
 * 다시 불러오므로, 화면이 열린 사이 다른 기기가 더한 사진이 캐시에만 있게 되고 — 메모만
 * 고친 저장이 변경으로 읽혀 사용자가 본 적 없는 사진을 지운다.
 *
 * 사진을 *정말로* 건드린 경우의 같은 문제는 이것으로 못 막는다. 목록은 통째로 하나의
 * 답이라 그 사진은 사라지고, 막으려면 서버가 버전을 비교해야 한다.
 */
export function samePhotoList(a: readonly PhotoEntry[], b: readonly PhotoEntry[]): boolean {
  return (
    a.length === b.length &&
    a.every((entry, index) => photoEntryKey(entry) === photoEntryKey(b[index]))
  )
}
