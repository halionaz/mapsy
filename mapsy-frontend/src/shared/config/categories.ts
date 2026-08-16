/**
 * 옷 카테고리 — PRD §5.1.
 *
 * 두 단계로 고정한다. 옷은 늘 정확히 하나의 소분류에 속하고, 대분류는 id 접두사에서
 * 파생된다.
 *
 * id는 저장 키라 데이터가 생긴 뒤에는 바꿀 수 없다 — `items.category_id`가 소분류 id를
 * 그대로 담는다. 표를 `as const`로 선언해 `SubcategoryId`가 `string`이 아닌 리터럴
 * 유니온이 되므로, `top.tshirtt` 같은 오타는 필터에 걸리지 않는 행이 아니라 컴파일 에러가 된다.
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
  /** `${groupId}.${slug}` — 접두사를 `groupIdOf`가 읽는다. */
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
 * 이 표가 실제로 대분류까지 풀어낼 수 있는 소분류 id.
 *
 * 오늘은 `SubcategoryId`와 같고, 그렇다고 말하는 주체가 컴파일러라는 것이 요점이다.
 * `SubcategoryDef.id`는 `${CategoryGroupId}.${string}`만 요구하므로, 표에서 지운 대분류의
 * 접두사를 단 소분류도 멀쩡한 `SubcategoryId`가 된다 — 그러면 `groupSections`가 그 옷을
 * 아무도 그리지 않는 `undefined` 칸에 넣는다.
 *
 * 단 결과가 자기 타입을 가진 자리에 놓일 때만 문다. 새 컨테이너는 원소 타입을 값에서
 * 추론해 `undefined`를 삼키므로, 옷장 레일이 `new Set<CategoryGroupId>(…)`로 쓴다.
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

/** 위 표에 있는 id인지. DB 문자열을 믿기 전에 쓴다. */
export function isSubcategoryId(value: string): value is SubcategoryId {
  return SUBCATEGORY_BY_ID.has(value)
}

/**
 * 소분류 id에서 대분류를 얻는다.
 *
 * 시그니처가 둘인 것은 id가 어디서 왔는지를 말하기 위해서다. 평범한 `string`은 DB 값이라
 * 옛 빌드가 쓴 id가 표에 없을 수 있고, 그쪽은 던지지 않고 undefined를 준다.
 * `SubcategoryId`는 위 표에서 나온 것이라 대분류가 반드시 있다.
 *
 * 좁은 쪽은 낙관이 아니라 양끝에서 붙들려 있다 — `mapRow.toCategoryId`가 경계에서
 * 모르는 id를 `etc.etc`로 접고, `ResolvableSubcategoryId`가 "표에 있음"을 "이 표에
 * 대분류가 있음"으로 만든다. 그 둘이 어느 구획에도 속하지 않는 옷을 위한 분기 없이
 * 옷장을 나눌 수 있게 한다.
 */
export function groupIdOf(categoryId: ResolvableSubcategoryId): CategoryGroupId
export function groupIdOf(categoryId: string): CategoryGroupId | undefined
export function groupIdOf(categoryId: string): CategoryGroupId | undefined {
  return GROUP_BY_ID.get(categoryId.split('.')[0])?.id
}

/** "상의 · 반팔티" */
export function categoryLabel(categoryId: string): string {
  const group = GROUP_BY_ID.get(categoryId.split('.')[0])
  const sub = SUBCATEGORY_BY_ID.get(categoryId)
  if (!group || !sub) return categoryId
  return `${group.label} · ${sub.label}`
}
