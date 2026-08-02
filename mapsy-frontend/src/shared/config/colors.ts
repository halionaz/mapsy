import { token } from 'styled-system/tokens'

/**
 * Clothing colour palette — PRD §5.3.
 *
 * Fixed 16-colour palette rather than free text. Free input turns
 * "베이지 / 아이보리 / 크림 / 오트밀" into four unrelated values and the colour
 * filter stops meaning anything; exact shade nuance belongs in the title or memo.
 *
 * The hex values live in `panda.config.ts` under `colors.swatch.*`, and nothing
 * in this file restates them. Labels are a `Record` keyed by `ColorId` rather
 * than a hand-written array, so adding an id without a label is a compile error
 * instead of a UI that renders the raw id.
 */

export const COLOR_IDS = [
  'black',
  'white',
  'gray',
  'beige',
  'brown',
  'navy',
  'blue',
  'sky',
  'green',
  'khaki',
  'yellow',
  'orange',
  'red',
  'pink',
  'purple',
  'multi',
] as const

export type ColorId = (typeof COLOR_IDS)[number]

const COLOR_LABELS: Record<ColorId, string> = {
  black: '블랙',
  white: '화이트',
  gray: '그레이',
  beige: '베이지',
  brown: '브라운',
  navy: '네이비',
  blue: '블루',
  sky: '스카이',
  green: '그린',
  khaki: '카키',
  yellow: '옐로우',
  orange: '오렌지',
  red: '레드',
  pink: '핑크',
  purple: '퍼플',
  multi: '멀티/패턴',
}

export interface ClothingColor {
  id: ColorId
  label: string
}

/** Display order follows COLOR_IDS — dark neutrals first, patterned last. */
export const CLOTHING_COLORS: ClothingColor[] = COLOR_IDS.map((id) => ({
  id,
  label: COLOR_LABELS[id],
}))

/** A garment may carry at most this many colours; the first one is the primary. */
export const MAX_COLORS_PER_ITEM = 3

export function colorLabel(id: ColorId): string {
  return COLOR_LABELS[id]
}

/**
 * `var(--colors-swatch-beige)` for a given id, used to paint dots from data at
 * runtime.
 *
 * Delegates to Panda's generated `token.var` rather than assembling the variable
 * name by hand. Hand-assembly happens to match today, but it silently encodes
 * assumptions about Panda's naming — setting `prefix` in panda.config.ts would
 * leave every dot transparent with no error anywhere. Asking the generated
 * helper removes the assumption.
 */
export function swatchVar(id: ColorId): string {
  return token.var(`colors.swatch.${id}`)
}
