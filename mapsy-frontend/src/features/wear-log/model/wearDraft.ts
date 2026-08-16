import { useSyncExternalStore } from 'react'

import { parseDay } from '@/shared/lib/calendarDay'

/**
 * 하루치로 고른 옷들, 제출되기 전.
 *
 * 이 값이 곧 선택 모드다. 목록 옆의 boolean이 아니라 상태 하나라 "고르는 중인데 날이
 * 없음"을 표현할 수 없다.
 *
 * 쿼리 캐시 밖인 이유는 `pendingUploads`와 같다 — `useWears`의 응답이 배열을 통째로
 * 갈아치우므로 창 포커스 갱신이 절반짜리 선택을 지운다. 다만 이쪽은 저장한다. 담는 것이
 * Blob이 아니라 날짜와 id 몇 개라, 적어두는 일이 오프라인 큐잉(PRD §8.5)이 되지 않는다.
 *
 * 재시작을 살아남는다는 것이 `isUsable`의 두 검사를 필수로 만든다.
 */

export interface WearDraft {
  /**
   * 누구의 선택인지.
   *
   * 세션보다 오래 살아서 저장한다. 로그아웃하고 다른 사람으로 로그인하면, 이것이 없을 때
   * 그 사람의 화면이 남의 선택을 들고 열린다 — 아래 옷장이 다른 것이라 체크된 카드는
   * 하나도 보이지 않는다.
   */
  userId: string
  /** 기록되는 날. */
  wornOn: string
  itemIds: string[]
}

const STORAGE_KEY = 'mapsy.wear-draft'

/**
 * 저장된 초안을 지금 화면이 다뤄도 되는지.
 *
 * 복원할 때 한 번이 아니라 읽을 때마다 *여기서* 본다. 자정을 넘겨 열려 있던 탭은 시계가
 * 지나가 버린 날의 초안을 들고 있고, 제출을 누르면 어느 하루의 옷이 다른 날에 기록된다.
 * 초안이 낡는 순간은 복원이 아니라 살아 있는 내내다.
 *
 * `today`를 호출부에서 받는 이유는 `useToday`가 있는 이유와 같다 — 여기서 시계를 한 번
 * 더 읽으면 화면이 그리는 값과 어긋날 수 있다.
 */
function isUsable(draft: WearDraft, owner: string | null, today: string): boolean {
  // `owner === null`을 위한 별도 가지는 없다. 초안은 늘 비어 있지 않은 `userId`를
  // 싣는다(쓰는 곳은 `load`와 `openWearDraft`뿐이고 둘 다 강제한다). 로그아웃한 화면은
  // 다른 불일치와 똑같이 이 비교에서 걸린다.
  return draft.userId === owner && draft.wornOn === today
}

/**
 * 저장된 초안을 읽는다. 초안이 아니면 null.
 *
 * 모양만 본다. 날이 아직 유효한지, 누구의 것인지는 `isUsable`이 답한다 — 이 함수는 모듈
 * 로드 시점에 돌아 비교할 세션도 없고, 오늘이 언제인지에 대해 다른 의견을 가질 이유도 없다.
 */
function load(): WearDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    // 캐스팅이 아니라 검증. 이전 버전의 앱이 쓴 유일한 입력이고, 그때의 모양은
    // 약속이 아니다.
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null

    const { userId, wornOn, itemIds } = parsed as Record<string, unknown>
    if (typeof userId !== 'string' || userId === '') return null
    if (typeof wornOn !== 'string' || parseDay(wornOn) === null) return null
    if (!Array.isArray(itemIds) || !itemIds.every((id) => typeof id === 'string')) return null

    return { userId, wornOn, itemIds }
  } catch {
    // 깨진 JSON이거나, localStorage 읽기가 던지는 Safari 사생활 보호 모드.
    // 둘 다 화면을 낼 일은 아니다 — 초안은 편의였다.
    return null
  }
}

let snapshot: WearDraft | null = load()
const listeners = new Set<() => void>()

function commit(next: WearDraft | null) {
  snapshot = next
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 이 탭 안에서는 초안이 그대로 산다. 잃는 것은 새로고침을 살아남는 능력뿐이다.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * 이 화면이 다뤄도 되는 초안, 혹은 null.
 *
 * `isUsable`을 통과하지 못한 초안은 그냥 돌려주지 않는다. 지우지 않고 저장소에 두는 것은
 * 지우기가 렌더 중의 쓰기가 되기 때문이고, 어차피 무해하다 — 이 저장소를 읽는 것은
 * 이것뿐이고 다음 `openWearDraft`가 덮는다.
 */
export function useWearDraft(owner: string | null, today: string): WearDraft | null {
  const draft = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
  return draft && isUsable(draft, owner, today) ? draft : null
}

/**
 * 그날이 이미 담고 있는 것으로 선택을 시작한다.
 *
 * 합치지 않고 대체한다. 지금은 오늘만 쓸 수 있어 넘겨올 것이 없지만, 날짜 피커가 생기는
 * 순간 손에 든 id는 *이전* 날의 것이 된다.
 */
export function openWearDraft(userId: string, wornOn: string, itemIds: Iterable<string>): void {
  commit({ userId, wornOn, itemIds: [...itemIds] })
}

export function toggleWearDraftItem(itemId: string): void {
  if (!snapshot) return
  const { itemIds } = snapshot
  commit({
    ...snapshot,
    itemIds: itemIds.includes(itemId)
      ? itemIds.filter((id) => id !== itemId)
      : [...itemIds, itemId],
  })
}

export function closeWearDraft(): void {
  commit(null)
}
