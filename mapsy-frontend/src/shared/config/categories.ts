/**
 * Clothing categories — PRD §5.1.
 *
 * Two fixed levels. The original brief mixed levels ("상의/하의" alongside
 * "청바지/롱슬리브"), so the hierarchy is pinned here: a garment always belongs
 * to exactly one subcategory, and its group is derived from the id prefix.
 *
 * Ids are stable storage keys and must not be renamed once data exists —
 * `items.category_id` holds the subcategory id verbatim. The table is declared
 * `as const` so `SubcategoryId` is a literal union rather than plain `string`,
 * which means a typo like `top.tshirtt` fails to compile instead of quietly
 * becoming an unfilterable row.
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

interface SubcategoryDef {
  /** `${groupId}.${slug}` — the prefix is what `groupIdOf` reads. */
  readonly id: `${CategoryGroupId}.${string}`
  readonly label: string
}

interface CategoryGroupDef {
  readonly id: CategoryGroupId
  readonly label: string
  readonly subcategories: readonly SubcategoryDef[]
}

export const CATEGORY_GROUPS = [
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
] as const satisfies readonly CategoryGroupDef[]

export type CategoryGroup = (typeof CATEGORY_GROUPS)[number]
export type Subcategory = CategoryGroup['subcategories'][number]
export type SubcategoryId = Subcategory['id']

/**
 * The subcategory ids this table can actually resolve to a group.
 *
 * Identical to `SubcategoryId` today, and the point is that the compiler is what
 * says so. `CATEGORY_GROUP_IDS` and `CATEGORY_GROUPS` are two hand-written lists
 * and nothing pairs them, while `SubcategoryDef.id` only demands
 * `${CategoryGroupId}.${string}` — so a subcategory can keep the prefix of a
 * group that has been deleted from the table and still be a perfectly good
 * `SubcategoryId`. Measured before this existed: with `onepiece` removed from
 * the table and `onepiece.dress` left sitting in 상의, `tsc -b` passed and the
 * garment stopped appearing on 내 옷장 — filed by `groupSections` under
 * `undefined`, a bucket nothing ever draws from.
 *
 * Narrowing `groupIdOf`'s total overload to this type moves that failure to
 * compile time and to the places that depend on it: `Item.categoryId` is a
 * `SubcategoryId`, so the day the two stop being the same type, a caller passing
 * one falls through to the `string` overload and is handed an `undefined`.
 *
 * It only bites where the result lands somewhere with a type of its own —
 * `Array.includes`, `Map.get`, `Map.set`. A fresh container infers its element
 * type *from* the value and swallows the `undefined` in silence, which is why
 * the wardrobe's rail writes `new Set<CategoryGroupId>(…)` rather than
 * `new Set(…)`; measured, that one type argument is the difference between the
 * broken table failing at three call sites and at two.
 */
type ResolvableSubcategoryId = Extract<
  SubcategoryId,
  `${(typeof CATEGORY_GROUPS)[number]['id']}.${string}`
>

const SUBCATEGORY_BY_ID = new Map<string, Subcategory>(
  CATEGORY_GROUPS.flatMap((group) =>
    group.subcategories.map((sub) => [sub.id, sub] as [string, Subcategory]),
  ),
)

const GROUP_BY_ID = new Map<string, CategoryGroup>(
  CATEGORY_GROUPS.map((group) => [group.id, group]),
)

/** True for ids that exist in the table above — use before trusting DB strings. */
export function isSubcategoryId(value: string): value is SubcategoryId {
  return SUBCATEGORY_BY_ID.has(value)
}

/**
 * Derives the group from a subcategory id.
 *
 * Two signatures, and which one applies says where the id came from. A plain
 * `string` is a database value, where an id written by an older build may no
 * longer be in the table — that arm returns undefined instead of throwing. A
 * `SubcategoryId` came out of the table above, so its group exists and there is
 * nothing for the caller to handle.
 *
 * The narrow arm is not an optimism, and it is held down at both ends.
 * `mapRow.toCategoryId` folds unrecognised ids to `etc.etc` at the boundary, so
 * every `Item` reaching the UI carries one of the ids listed here; and
 * `ResolvableSubcategoryId` is what makes "listed here" mean "has a group in
 * this table" rather than merely "looks like one". Together they are what lets
 * the wardrobe be split into sections without a branch for garments that belong
 * to no section — a branch that could only ever be written as "drop it", which
 * on the home screen reads as the item having been deleted.
 */
export function groupIdOf(categoryId: ResolvableSubcategoryId): CategoryGroupId
export function groupIdOf(categoryId: string): CategoryGroupId | undefined
export function groupIdOf(categoryId: string): CategoryGroupId | undefined {
  return GROUP_BY_ID.get(categoryId.split('.')[0])?.id
}

/** "상의 · 반팔티" — used in the item detail view and search results. */
export function categoryLabel(categoryId: string): string {
  const group = GROUP_BY_ID.get(categoryId.split('.')[0])
  const sub = SUBCATEGORY_BY_ID.get(categoryId)
  if (!group || !sub) return categoryId
  return `${group.label} · ${sub.label}`
}
