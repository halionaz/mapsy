/**
 * 착용 기록의 도메인 타입.
 *
 * 착용은 (옷, 날) 짝에 대한 사실이고 그 밖에는 아무것도 싣지 않는다 — 메모도, 시각도,
 * 순서도. 코디 엔티티가 없는 이유가 그것이다. "함께 입은 것"은 같은 `wornOn`을 가진
 * 항목들의 집합이라 저장이 아니라 파생이다.
 *
 * 행에는 `id`·`user_id`·`created_at`도 있다. 여기 없는 것은 아무도 읽지 않기 때문이다 —
 * 컬렉션은 통째로 받고 모든 연산이 (옷, 날)로 행을 가리키며, 그것이 유니크 키이기도 하다.
 */
export interface WearEntry {
  itemId: string
  /** 입은 사람의 로컬 달력 날짜, `YYYY-MM-DD`. `shared/lib/calendarDay` 참고. */
  wornOn: string
}

/** 옷 하나의 착용 이력을 요약한 것. */
export interface WearSummary {
  wearCount: number
  /**
   * 가장 최근에 입은 날. 한 번도 안 입었으면 null.
   *
   * null은 "오래전"이 아니라 "답 없음"이고, 옷장의 최근 입은순은 날짜를 대신 넣지 않고
   * 그 구분 위에서 정렬한다.
   */
  lastWornOn: string | null
}

/** 착용 이력이 붙은 옷. 격자가 정렬하고 그리는 형태다. */
export type Worn<T> = T & WearSummary
