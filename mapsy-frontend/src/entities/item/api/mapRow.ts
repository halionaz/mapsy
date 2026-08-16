import { COLOR_IDS, type ColorId } from '@/shared/config/colors'
import { SEASON_IDS, type SeasonId } from '@/shared/config/seasons'
import { isSubcategoryId, type SubcategoryId } from '@/shared/config/categories'
import type { Database } from '@/shared/api/database.types'
import type { PhotoEntry } from '../model/photoEntries'
import type { Item, ItemDraft, ItemImage, ItemStatus } from '../model/types'

/**
 * Postgres 행(snake_case, 느슨함)과 도메인 객체(camelCase, 좁음) 사이의 번역.
 *
 * 네트워크 호출과 떼어 순수하게 두어, 실제 판단이 들어 있는 매핑을 DB 없이 테스트할 수 있게 한다.
 *
 * 읽기는 방어적이다. 다른 빌드가 쓴 행일 수 있으므로, 모르는 열거 값은 "그럴 수 없다"고
 * 약속하는 유니온에 밀어 넣지 않고 버린다.
 */

// 손으로 쓰지 않고 실제 스키마에서 파생한다(`pnpm types:gen`) — 컬럼 이름이 바뀌면
// 런타임 놀람이 아니라 여기서 컴파일 에러가 된다.
export type ItemRow = Database['public']['Tables']['items']['Row']
export type ItemImageRow = Database['public']['Tables']['item_images']['Row']
export type ItemInsert = Database['public']['Tables']['items']['Insert']
export type ItemUpdate = Database['public']['Tables']['items']['Update']
export type ItemImageInsert = Database['public']['Tables']['item_images']['Insert']

const COLOR_SET = new Set<string>(COLOR_IDS)
const SEASON_SET = new Set<string>(SEASON_IDS)

// 배열 컬럼이 `not null default '{}'`이라 생성된 행 타입도 `string[]`이다. 그래도 값을
// 거른다 — 더 넓은 팔레트를 가진 빌드가 쓴 행이 모르는 id를 ColorId로 밀입국시키면 안 된다.
function toColors(value: string[]): ColorId[] {
  return value.filter((c): c is ColorId => COLOR_SET.has(c))
}

function toSeasons(value: string[]): SeasonId[] {
  return value.filter((s): s is SeasonId => SEASON_SET.has(s))
}

function toStatus(value: string): ItemStatus {
  // 모르는 값은 보유로 본다 — 가진 옷을 감추는 쪽이 처분한 옷을 보이는 쪽보다 나쁘다.
  return value === 'disposed' ? 'disposed' : 'owned'
}

function toCategoryId(value: string): SubcategoryId {
  // DB는 대분류 접두사만 검증하므로 앱에서 없앤 소분류가 여전히 올 수 있다. 기타로
  // 올려두면 모든 필터에서 사라지는 대신 손에 닿는 곳에 남는다.
  return isSubcategoryId(value) ? value : 'etc.etc'
}

export function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    categoryId: toCategoryId(row.category_id),
    brand: row.brand,
    size: row.size,
    fit: row.fit,
    colors: toColors(row.colors),
    seasons: toSeasons(row.seasons),
    price: row.price,
    purchasedAt: row.purchased_at,
    purchasePlace: row.purchase_place,
    memo: row.memo,
    tags: row.tags,
    status: toStatus(row.status),
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 올라간 사진이 무엇인지 — 어디에 놓이는지는 빼고. 위치는 호출부의 몫이다.
 *
 * interface가 아니라 타입 별칭이고 camelCase가 아니라 snake_case인 것은 같은 이유다.
 * 이 값은 행이나 RPC의 `jsonb` 인자로 그대로 펼쳐지고, `Json`이 요구하는 암묵적 인덱스
 * 시그니처는 별칭만 싣는다.
 */
export type UploadedImage = {
  id: string
  path: string
  thumb_path: string
  width: number
  height: number
}

/**
 * `set_item_images`가 받는 배열 — 폼의 순서에, 고른 항목마다 그 업로드가 만든 행을 끼운 것.
 *
 * `uploaded`가 고른 항목이 나온 순서대로라 둘을 나란히 걷는 것이 새 사진을 폼이 놓은
 * 자리에 놓는다. 여기를 틀려도 실패하지 않는다 — 화면과 다른 순서로 조용히 저장될 뿐이고,
 * 그 순서가 화면의 전부였다.
 */
export function toImagePayload(
  entries: readonly PhotoEntry[],
  uploaded: readonly UploadedImage[],
): ({ id: string } | UploadedImage)[] {
  let next = 0
  return entries.map((entry) =>
    entry.kind === 'stored' ? { id: entry.image.id } : uploaded[next++],
  )
}

export function toItemImage(row: ItemImageRow): ItemImage {
  return {
    id: row.id,
    itemId: row.item_id,
    userId: row.user_id,
    path: row.path,
    thumbPath: row.thumb_path,
    sortOrder: row.sort_order,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  }
}

/**
 * draft가 쓰는 컬럼. insert와 update가 공유한다.
 *
 * 비어 있는 선택 텍스트는 빈 문자열이 아니라 null이 된다 — "브랜드 없음"의 표현이
 * 둘이면 필터와 `is null` 질의가 양쪽을 다 봐야 한다.
 */
function toItemFields(draft: ItemDraft) {
  return {
    title: draft.title.trim(),
    category_id: draft.categoryId,
    brand: blankToNull(draft.brand),
    size: blankToNull(draft.size),
    fit: blankToNull(draft.fit),
    colors: draft.colors ?? [],
    seasons: draft.seasons ?? [],
    price: draft.price ?? null,
    purchased_at: blankToNull(draft.purchasedAt),
    purchase_place: blankToNull(draft.purchasePlace),
    memo: blankToNull(draft.memo),
    // 여기서 다듬고 중복을 없앤다 — 컬렉션에서 파생하는 자동완성이 "출근용"을 두 번
    // 내놓지 않도록.
    tags: uniqueTags(draft.tags ?? []),
  }
}

export function toItemInsert(draft: ItemDraft, userId: string): ItemInsert {
  return { ...toItemFields(draft), user_id: userId, is_favorite: draft.isFavorite ?? false }
}

/**
 * 편집 폼이 소유한 것만 쓴다.
 *
 * `user_id`가 없는 것은 소유가 생성 때 정해지기 때문이다 — 보내봐야 잘해야 무효고
 * 잘못하면 RLS 검사에 걸린다. 타입에서 빼는 쪽이 나중에 키를 지우는 것보다 강하다.
 *
 * `is_favorite`가 없는 것은 다른 이유다. 별은 이 폼이 아니라 상세 화면에 있다. 넣으면
 * 편집 화면을 열어둔 채 다른 곳에서 별을 켠 뒤 저장했을 때 조용히 꺼진다.
 */
export function toItemUpdate(draft: ItemDraft): ItemUpdate {
  return toItemFields(draft)
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const tag of tags) {
    const trimmed = tag.trim().replace(/^#/, '')
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}
