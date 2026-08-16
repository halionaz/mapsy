import { token } from 'styled-system/tokens'

/**
 * 옷 색상 팔레트 — PRD §5.3.
 *
 * 자유 입력이 아니라 16색 고정이다. 자유 입력은 "베이지 / 아이보리 / 크림 / 오트밀"을
 * 서로 무관한 네 값으로 만들고 색상 필터의 뜻을 지운다. 정확한 뉘앙스는 이름이나 메모의 몫.
 *
 * hex는 `panda.config.ts`의 `colors.swatch.*`에 있고 이 파일은 그것을 되풀이하지 않는다.
 * 라벨이 배열이 아니라 `ColorId` 키의 `Record`인 것은, 라벨 없이 id만 추가하면 원시 id를
 * 그리는 UI가 아니라 컴파일 에러가 되게 하기 위해서다.
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

/** 표시 순서는 COLOR_IDS를 따른다 — 어두운 무채색 먼저, 패턴이 마지막. */
export const CLOTHING_COLORS: ClothingColor[] = COLOR_IDS.map((id) => ({
  id,
  label: COLOR_LABELS[id],
}))

/** 옷 하나가 가질 수 있는 색상의 최대 개수. 첫 번째가 대표색이다. */
export const MAX_COLORS_PER_ITEM = 3

export function colorLabel(id: ColorId): string {
  return COLOR_LABELS[id]
}

/**
 * id에 해당하는 `var(--colors-swatch-beige)`. 런타임에 데이터로 점을 칠하는 데 쓴다.
 *
 * 변수 이름을 손으로 조립하지 않고 Panda가 생성한 `token.var`에 맡긴다. 손 조립은
 * Panda의 명명 규칙을 조용히 가정하고, panda.config.ts에 `prefix`를 넣는 순간 모든 점이
 * 아무 에러 없이 투명해진다.
 */
export function swatchVar(id: ColorId): string {
  return token.var(`colors.swatch.${id}`)
}
