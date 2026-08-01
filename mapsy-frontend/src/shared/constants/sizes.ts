/**
 * Size presets — PRD §5.4.
 *
 * Sizing systems differ per category: a top is M, trousers are 30 inches, shoes
 * are 270mm. Collapsing those into one free-text field makes the size filter
 * useless, so the form offers the presets for the chosen category and falls back
 * to free input for anything unusual (brand-specific runs, imported labels).
 *
 * The stored value is always a plain string — preset or typed — so the schema
 * stays a single `size` column.
 */

import type { CategoryGroupId } from './categories'

const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'FREE']

const BOTTOM_SIZES = [
  '26',
  '27',
  '28',
  '29',
  '30',
  '31',
  '32',
  '33',
  '34',
  '36',
  '38',
  'S',
  'M',
  'L',
  'XL',
  'FREE',
]

// 220–300mm in 5mm steps, matching how Korean shoe sizes are labelled.
const SHOE_SIZES = Array.from({ length: 17 }, (_, i) => String(220 + i * 5))

const FREE_ONLY = ['FREE']

export const SIZE_PRESETS: Record<CategoryGroupId, string[]> = {
  top: APPAREL_SIZES,
  outer: APPAREL_SIZES,
  onepiece: APPAREL_SIZES,
  bottom: BOTTOM_SIZES,
  shoes: SHOE_SIZES,
  bag: FREE_ONLY,
  accessory: FREE_ONLY,
  etc: FREE_ONLY,
}

export function sizePresetsFor(groupId: CategoryGroupId | undefined): string[] {
  return groupId ? SIZE_PRESETS[groupId] : []
}
