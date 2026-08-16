/**
 * 옷장의 도메인 타입.
 *
 * `shared/api/database.types.ts`와 다르다. 그쪽은 실제 스키마에서 생성되어 Postgres가
 * 돌려주는 그대로를 서술한다 — snake_case이고, DB가 느슨한 곳에서는 느슨하다
 * (`colors: string[]`, `status: string`). 여기는 앱이 다루는 것이다 — camelCase이고,
 * UI가 실제로 그릴 수 있는 유니온으로 좁혀져 있다. 경계는 `../api/mapRow.ts`.
 *
 * 타입만 둔다. 런타임 값은 `shared/config`나 그것을 소유한 슬라이스로 — 그래야
 * `import type`이 계속 쓸 수 있다.
 */

import type { SubcategoryId } from '@/shared/config/categories'
import type { ColorId } from '@/shared/config/colors'
import type { SeasonId } from '@/shared/config/seasons'

/** 팔거나 준 옷은 지우지 않고 감춘다 — 구매 이력이 남도록. 옷장은 `owned`만 그린다. */
export type ItemStatus = 'owned' | 'disposed'

export interface ItemImage {
  id: string
  itemId: string
  /**
   * 부모 옷에서 비정규화한 값. `item_images`가 자기 `user_id`를 갖는 것은 RLS 정책이
   * 행 자체의 `user_id = auth.uid()`이기 때문이다 — 빼고 insert하면 거부되므로 타입에서도
   * 뺄 수 없다.
   */
  userId: string
  /** 원본의 스토리지 경로 (긴 변 1280, WebP). */
  path: string
  /** 1:1로 자른 썸네일의 스토리지 경로 (400×400, WebP). */
  thumbPath: string
  /**
   * 0이 격자에 보이는 커버다 — 커버를 바꾸는 방법이 곧 재정렬이다.
   *
   * DB에서 0–4로 제약되고, 그것이 "사진 최대 5장"을 강제한다. 그 CHECK는 즉시라
   * 재정렬 도중 99 같은 표시값에 행을 **세워두면 안 된다**. 한 트랜잭션 안에서 값을
   * 직접 맞바꾸고 지연된 유니크 제약이 커밋 때 정리하게 둔다. supabase/README.md 참고.
   */
  sortOrder: number
  width: number | null
  height: number | null
  createdAt: string
}

export interface Item {
  id: string
  userId: string

  title: string
  categoryId: SubcategoryId

  brand: string | null
  size: string | null
  fit: string | null
  /** 최대 MAX_COLORS_PER_ITEM개. 첫 번째가 카드에 보이는 대표색이다. */
  colors: ColorId[]
  seasons: SeasonId[]
  /** 원 단위 정수. */
  price: number | null
  /** `YYYY-MM-DD`. */
  purchasedAt: string | null
  purchasePlace: string | null
  memo: string | null
  tags: string[]

  status: ItemStatus
  isFavorite: boolean

  createdAt: string
  updatedAt: string
}

/** 사진까지 붙은 옷. 격자와 상세 화면이 쓰는 형태다. */
export interface ItemWithImages extends Item {
  images: ItemImage[]
}

/**
 * 옷장 쿼리가 UI에 건네는 것 — 옷, 사진, 그리고 바로 그릴 수 있는 커버 URL.
 *
 * 커버는 목록 쿼리가 서명하므로 격자가 카드마다 왕복하지 않아도 그려진다. 원본은
 * 아니다 — `features/item-photos` 참고.
 */
export interface WardrobeItem extends ItemWithImages {
  /** 커버 사진의 서명된 썸네일 URL. 없으면 null. */
  coverUrl: string | null
}

/** 등록 폼이 모으는 필드. 이름·카테고리 뒤는 전부 선택이다. */
export type ItemDraft = Pick<Item, 'title' | 'categoryId'> &
  Partial<
    Pick<
      Item,
      | 'brand'
      | 'size'
      | 'fit'
      | 'colors'
      | 'seasons'
      | 'price'
      | 'purchasedAt'
      | 'purchasePlace'
      | 'memo'
      | 'tags'
      | 'isFavorite'
    >
  >
