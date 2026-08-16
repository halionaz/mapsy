/**
 * 착용 기록 기능의 공개 API — 옷장 격자에서 입은 옷을 기록한다.
 *
 * `entities/wear`가 아니라 feature인 것은, 여기 있는 어느 것도 착용이 *무엇인지*에 대한
 * 것이 아니기 때문이다 — 진행 중인 선택, 그것을 나르는 버튼, 어느 날을 쓰는지 말하는 행.
 * 아래 엔티티는 그중 아무것도 모른다.
 */

export {
  closeWearDraft,
  openWearDraft,
  toggleWearDraftItem,
  useWearDraft,
  type WearDraft,
} from './model/wearDraft'

export { WearFab } from './ui/WearFab'
export { WearSelectionBar } from './ui/WearSelectionBar'
