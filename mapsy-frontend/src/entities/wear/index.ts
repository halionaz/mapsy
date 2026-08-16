/**
 * 착용 기록 엔티티의 공개 API.
 *
 * 하루에 입은 옷. `entities/item`의 컬럼 몇 개가 아니라 별개 엔티티인 것은, 둘이 쓰이는
 * 빈도가 완전히 다르기 때문이다 — 옷은 한 번 등록하고 드물게 고치지만 착용은 매일 아침
 * 기록된다. 떼어 둔 덕에 착용 토글이 옷 캐시와 그 안의 모든 서명 URL을 건드리지 않는다.
 */

export type { WearEntry, WearSummary, Worn } from './model/types'

export { dropItemWears, useSetWears, useToggleWear, useWears } from './model/queries'

// `summarizeWears`는 일부러 없다. 유일한 호출부가 옆의 `attachWears`이고, 테스트는
// 모듈로 직접 닿는다.
export { attachWears, itemIdsWornOn } from './lib/wearStats'
