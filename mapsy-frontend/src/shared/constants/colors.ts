/**
 * Clothing colour palette — PRD §5.3.
 *
 * Fixed 16-colour palette rather than free text. Free input turns
 * "베이지 / 아이보리 / 크림 / 오트밀" into four unrelated values and the colour
 * filter stops meaning anything; exact shade nuance belongs in the title or memo.
 *
 * The hex values live in `panda.config.ts` under `colors.swatch.*` — this file
 * deliberately holds none, so there is exactly one source of truth. Swatch dots
 * read the generated CSS variable at runtime (see `cssVarOf`), which keeps the
 * value dynamic without Panda needing to statically see it.
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

export interface ClothingColor {
  id: ColorId
  label: string
}

export const CLOTHING_COLORS: ClothingColor[] = [
  { id: 'black', label: '블랙' },
  { id: 'white', label: '화이트' },
  { id: 'gray', label: '그레이' },
  { id: 'beige', label: '베이지' },
  { id: 'brown', label: '브라운' },
  { id: 'navy', label: '네이비' },
  { id: 'blue', label: '블루' },
  { id: 'sky', label: '스카이' },
  { id: 'green', label: '그린' },
  { id: 'khaki', label: '카키' },
  { id: 'yellow', label: '옐로우' },
  { id: 'orange', label: '오렌지' },
  { id: 'red', label: '레드' },
  { id: 'pink', label: '핑크' },
  { id: 'purple', label: '퍼플' },
  { id: 'multi', label: '멀티/패턴' },
]

/** A garment may carry at most this many colours; the first one is the primary. */
export const MAX_COLORS_PER_ITEM = 3

const LABEL_BY_ID = new Map(CLOTHING_COLORS.map((c) => [c.id, c.label]))

export function colorLabel(id: ColorId): string {
  return LABEL_BY_ID.get(id) ?? id
}

/**
 * The CSS variable Panda emits for a swatch token, e.g. `--colors-swatch-beige`.
 * Used to paint dots from data at runtime. This is a variable *name*, not a
 * Panda class, so building it from an id is safe — nothing needs extracting.
 */
export function cssVarOf(id: ColorId): string {
  return `--colors-swatch-${id}`
}
