import { useSyncExternalStore } from 'react'

import { releasePreview, type ProcessedPhoto } from '@/shared/lib/image'
import type { ItemDraft } from './types'

/**
 * 아직 서버에 닿지 않은 등록.
 *
 * 쿼리 캐시 밖에 두는 것은 의도다. 낙관적 엔트리로 캐시에 있던 시절, `useWardrobe`의
 * 응답이 그 배열을 통째로 갈아치워 어떤 갱신이든 진행 중인 등록을 지웠다. 카드가
 * 사라지고 재시도 버튼으로 가는 유일한 길도 함께 사라지는데, blob은 메모리에 닿을 수
 * 없는 채로 남았다.
 *
 * 여기 두면 갱신이 아예 무관해진다.
 *
 * 수명은 탭까지다. 완전한 오프라인 큐잉은 범위 밖이고(PRD §8.5), Blob을 IndexedDB에
 * 남기는 것이 그 기능이다.
 */

export interface PendingUpload {
  tempId: string
  draft: ItemDraft
  photos: ProcessedPhoto[]
  userId: string
  state: 'uploading' | 'failed'
  /** 왜 실패했는지. 카드가 "실패" 이상을 말할 수 있도록. */
  error?: string
}

let snapshot: PendingUpload[] = []
const listeners = new Set<() => void>()

function commit(next: PendingUpload[]) {
  snapshot = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePendingUploads(): PendingUpload[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
}

export function getPending(tempId: string): PendingUpload | undefined {
  return snapshot.find((entry) => entry.tempId === tempId)
}

/** 최신이 먼저 — 옷장의 기본 순서와 같게. */
export function addPending(entry: PendingUpload): void {
  commit([entry, ...snapshot.filter((e) => e.tempId !== entry.tempId)])
}

export function markPendingState(
  tempId: string,
  state: PendingUpload['state'],
  error?: string,
): void {
  commit(snapshot.map((e) => (e.tempId === tempId ? { ...e, state, error } : e)))
}

/**
 * 항목을 지우고 미리보기 object URL을 반납한다.
 *
 * 배열을 직접 거르지 않고 늘 여기를 거친다 — 반납 없이 blob이 버려질 수 없도록.
 */
export function removePending(tempId: string): void {
  const entry = getPending(tempId)
  if (!entry) return
  entry.photos.forEach(releasePreview)
  commit(snapshot.filter((e) => e.tempId !== tempId))
}
