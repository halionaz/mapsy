/**
 * Fit presets — PRD §5.5.
 *
 * Tops and bottoms describe fit with different vocabulary, and for shoes, bags
 * and accessories the concept doesn't apply at all — those groups return an
 * empty list and the form hides the field rather than showing a dead control.
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
