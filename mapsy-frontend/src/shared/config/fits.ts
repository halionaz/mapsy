/**
 * 핏 프리셋 — PRD §5.5.
 *
 * 상의와 하의는 핏을 다른 어휘로 말하고, 신발·가방·액세서리에는 개념 자체가 없다 —
 * 그 대분류는 빈 목록을 돌려주고 폼은 죽은 컨트롤 대신 필드를 감춘다.
 */

import type { CategoryGroupId } from './categories'

const APPAREL_FITS = ['슬림', '레귤러', '세미오버', '오버', '크롭']

const BOTTOM_FITS = ['스키니', '슬림', '스트레이트', '테이퍼드', '와이드', '부츠컷', '크롭']

export const FIT_PRESETS: Record<CategoryGroupId, string[]> = {
  top: APPAREL_FITS,
  outer: APPAREL_FITS,
  onepiece: APPAREL_FITS,
  bottom: BOTTOM_FITS,
  shoes: [],
  bag: [],
  accessory: [],
  etc: [],
}

export function fitPresetsFor(groupId: CategoryGroupId | undefined): string[] {
  return groupId ? FIT_PRESETS[groupId] : []
}

export function hasFitField(groupId: CategoryGroupId | undefined): boolean {
  return fitPresetsFor(groupId).length > 0
}
