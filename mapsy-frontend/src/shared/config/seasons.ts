/**
 * 계절 — PRD §5.6.
 *
 * 옷장을 가장 자주 거르는 축이고, v1의 "뭐가 없나" 격자(카테고리 × 계절)의 전제다.
 * 다중 선택이고 비워도 된다 — 사계절 옷은 실제로 많다.
 */

export const SEASON_IDS = ['spring', 'summer', 'fall', 'winter'] as const

export type SeasonId = (typeof SEASON_IDS)[number]

/**
 * `items_seasons_limit`의 거울.
 *
 * 오늘은 `SEASON_IDS.length`와 같고, 그래서 파생하지 않고 적어 둔다. 폼이 DB가 허용하는
 * 만큼만 칩을 내주는 것이 *우연*이었고, 다섯 번째 계절이 생기면 다섯 개를 고르고 사진
 * 다섯 장을 올린 뒤 INSERT에서 거부당한다.
 */
export const MAX_SEASONS_PER_ITEM = 4

/** SeasonId 키라, 라벨 없는 계절은 나갈 수 없다. */
const SEASON_LABELS: Record<SeasonId, string> = {
  spring: '봄',
  summer: '여름',
  fall: '가을',
  winter: '겨울',
}

export interface Season {
  id: SeasonId
  label: string
}

export const SEASONS: Season[] = SEASON_IDS.map((id) => ({
  id,
  label: SEASON_LABELS[id],
}))

export function seasonLabel(id: SeasonId): string {
  return SEASON_LABELS[id]
}
