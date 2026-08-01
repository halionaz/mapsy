/**
 * Clothing categories — PRD §5.1.
 *
 * Two fixed levels. The original brief mixed levels ("상의/하의" alongside
 * "청바지/롱슬리브"), so the hierarchy is pinned here: a garment always belongs
 * to exactly one subcategory, and its group is derived from the id prefix.
 *
 * Ids are stable storage keys and must not be renamed once data exists —
 * `items.category_id` holds the subcategory id verbatim.
 */

export const CATEGORY_GROUP_IDS = [
  'top',
  'bottom',
  'outer',
  'onepiece',
  'shoes',
  'bag',
  'accessory',
  'etc',
] as const

export type CategoryGroupId = (typeof CATEGORY_GROUP_IDS)[number]

export interface Subcategory {
  /** `${groupId}.${slug}` — e.g. `top.tshirt_short` */
  id: string
  label: string
}

export interface CategoryGroup {
  id: CategoryGroupId
  label: string
  subcategories: Subcategory[]
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'top',
    label: '상의',
    subcategories: [
      { id: 'top.tshirt_short', label: '반팔티' },
      { id: 'top.tshirt_long', label: '긴팔티' },
      { id: 'top.shirt', label: '셔츠/블라우스' },
      { id: 'top.knit', label: '니트/스웨터' },
      { id: 'top.sweatshirt', label: '후드/맨투맨' },
      { id: 'top.sleeveless', label: '슬리브리스' },
      { id: 'top.etc', label: '기타 상의' },
    ],
  },
  {
    id: 'bottom',
    label: '하의',
    subcategories: [
      { id: 'bottom.denim', label: '데님' },
      { id: 'bottom.slacks', label: '슬랙스' },
      { id: 'bottom.cotton', label: '면바지' },
      { id: 'bottom.training', label: '트레이닝' },
      { id: 'bottom.shorts', label: '쇼츠' },
      { id: 'bottom.skirt', label: '스커트' },
      { id: 'bottom.etc', label: '기타 하의' },
    ],
  },
  {
    id: 'outer',
    label: '아우터',
    subcategories: [
      { id: 'outer.jacket', label: '자켓' },
      { id: 'outer.coat', label: '코트' },
      { id: 'outer.padding', label: '패딩' },
      { id: 'outer.cardigan', label: '가디건' },
      { id: 'outer.blazer', label: '블레이저' },
      { id: 'outer.fleece', label: '후리스' },
      { id: 'outer.vest', label: '베스트' },
      { id: 'outer.etc', label: '기타 아우터' },
    ],
  },
  {
    id: 'onepiece',
    label: '원피스/셋업',
    subcategories: [
      { id: 'onepiece.dress', label: '원피스' },
      { id: 'onepiece.jumpsuit', label: '점프수트' },
      { id: 'onepiece.setup', label: '셋업' },
    ],
  },
  {
    id: 'shoes',
    label: '신발',
    subcategories: [
      { id: 'shoes.sneakers', label: '스니커즈' },
      { id: 'shoes.boots', label: '부츠' },
      { id: 'shoes.dress', label: '구두' },
      { id: 'shoes.sandals', label: '샌들/슬리퍼' },
      { id: 'shoes.etc', label: '기타 신발' },
    ],
  },
  {
    id: 'bag',
    label: '가방',
    subcategories: [
      { id: 'bag.backpack', label: '백팩' },
      { id: 'bag.shoulder', label: '숄더백' },
      { id: 'bag.tote', label: '토트백' },
      { id: 'bag.cross', label: '크로스백' },
      { id: 'bag.clutch', label: '클러치' },
      { id: 'bag.etc', label: '기타 가방' },
    ],
  },
  {
    id: 'accessory',
    label: '액세서리',
    subcategories: [
      { id: 'accessory.hat', label: '모자' },
      { id: 'accessory.scarf', label: '목도리/머플러' },
      { id: 'accessory.gloves', label: '장갑' },
      { id: 'accessory.belt', label: '벨트' },
      { id: 'accessory.jewelry', label: '주얼리' },
      { id: 'accessory.watch', label: '시계' },
      { id: 'accessory.eyewear', label: '안경/선글라스' },
      { id: 'accessory.socks', label: '양말' },
      { id: 'accessory.etc', label: '기타 액세서리' },
    ],
  },
  {
    id: 'etc',
    label: '기타',
    subcategories: [{ id: 'etc.etc', label: '기타' }],
  },
]

const SUBCATEGORY_BY_ID = new Map(
  CATEGORY_GROUPS.flatMap((group) => group.subcategories.map((sub) => [sub.id, sub])),
)

const GROUP_BY_ID = new Map(CATEGORY_GROUPS.map((group) => [group.id, group]))

/** Derives the group from a subcategory id. Returns undefined for unknown ids. */
export function groupIdOf(categoryId: string): CategoryGroupId | undefined {
  const prefix = categoryId.split('.')[0]
  return GROUP_BY_ID.has(prefix as CategoryGroupId)
    ? (prefix as CategoryGroupId)
    : undefined
}

export function findSubcategory(categoryId: string): Subcategory | undefined {
  return SUBCATEGORY_BY_ID.get(categoryId)
}

export function findGroup(groupId: CategoryGroupId): CategoryGroup | undefined {
  return GROUP_BY_ID.get(groupId)
}

/** "상의 · 반팔티" — used in the item detail view and search results. */
export function categoryLabel(categoryId: string): string {
  const groupId = groupIdOf(categoryId)
  const group = groupId ? GROUP_BY_ID.get(groupId) : undefined
  const sub = SUBCATEGORY_BY_ID.get(categoryId)
  if (!group || !sub) return categoryId
  return `${group.label} · ${sub.label}`
}
