import type { WearEntry, WearSummary, Worn } from '../model/types'

/**
 * 착용 기록을 화면이 실제로 묻는 것으로 바꾼다.
 *
 * 전부 배열 하나에서 클라이언트가 파생한다 — 옷장이 이미 건 것과 같은 내기다(PRD §8.4).
 * 대안인 `wear_count` 컬럼과 트리거는 읽기를 싸게 만드는 대신 여기서 중요한 것을 치른다.
 * 개수와 최댓값은 이 데이터가 답하는 질문의 둘일 뿐이고, 어제 입었는지도, 어떤 옷들이
 * 하루를 공유하는지도, 나중의 달력도 행에서 공짜로 나온다.
 */

const EMPTY: WearSummary = { wearCount: 0, lastWornOn: null }

/**
 * 옷별 합계를 한 번에.
 *
 * `lastWornOn`은 문자열 비교이고, 운이 아니라 정확하다 — `YYYY-MM-DD`는 폭이 고정이고
 * 0으로 채워져 있어 사전순이 곧 달력순이다. Date를 만들지 않는다. 수천 행을 비교하려고
 * 파싱하는 것은 일이고, 파싱마다 타임존이 끼어들 자리가 하나씩 는다.
 */
export function summarizeWears(entries: readonly WearEntry[]): Map<string, WearSummary> {
  const summary = new Map<string, WearSummary>()

  for (const entry of entries) {
    const current = summary.get(entry.itemId)
    if (!current) {
      summary.set(entry.itemId, { wearCount: 1, lastWornOn: entry.wornOn })
      continue
    }
    current.wearCount += 1
    // null 가지는 닿지 않는다 — 이 맵의 모든 항목은 날과 함께 만들어졌다 — 그래도
    // 타입을 맞추려고만 존재하는 `''` 표시값과 비교하는 것보다는 적어두는 쪽이 낫다.
    if (current.lastWornOn === null || entry.wornOn > current.lastWornOn) {
      current.lastWornOn = entry.wornOn
    }
  }

  return summary
}

/**
 * 착용 이력이 붙은 옷들.
 *
 * 옷 쿼리가 아니라 여기서 합치므로 착용 토글이 옷장 캐시를 건드리지 않는다.
 *
 * 항목이 없는 옷에도 요약을 준다 — 필드가 그냥 없는 옷이면 그것을 읽는 세 곳에서 각각
 * null 검사를 해야 하고, 그중 하나는 비교 함수다.
 */
export function attachWears<T extends { id: string }>(
  items: readonly T[],
  entries: readonly WearEntry[],
): Worn<T>[] {
  const summary = summarizeWears(entries)
  return items.map((item) => ({ ...item, ...(summary.get(item.id) ?? EMPTY) }))
}

/** 하루에 입은 옷들 — 선택 모드가 그것으로 열린다. */
export function itemIdsWornOn(entries: readonly WearEntry[], day: string): Set<string> {
  const ids = new Set<string>()
  for (const entry of entries) {
    if (entry.wornOn === day) ids.add(entry.itemId)
  }
  return ids
}
