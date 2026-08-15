/**
 * Human-readable text for anything thrown by the data layer.
 *
 * Supabase's query results carry a plain `{ message, details, hint, code }`
 * object rather than an Error — the client only constructs `PostgrestError` on
 * the `throwOnError` path, which this app does not use. So `instanceof Error`
 * is false and `String(error)` renders "[object Object]", which is what the
 * wardrobe's failure card was showing instead of a reason.
 */

/**
 * Every constraint in the `public` schema, mapped to something a person can act
 * on. The form mirrors most of these and normally catches them first; this is
 * the surface left over for anything that slips past, and it should not be raw
 * Postgres text on a Korean screen.
 *
 * Complete rather than "the ones we expect to hit" — deciding which unreachable
 * ones to skip is the judgement that left gaps three times running. It is no
 * longer maintained by hand either: `dbConstraints.generated.ts` is produced
 * from the schema by `pnpm test:db`, and a unit test fails if this map does not
 * cover it.
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  items_title_length: '이름이 너무 길어요.',
  items_memo_length: '메모가 너무 길어요.',
  items_brand_length: '브랜드 이름이 너무 길어요.',
  items_size_length: '사이즈 표기가 너무 길어요.',
  // Fit only ever comes from preset chips, so this is unreachable today — listed
  // so the map stays a complete mirror of the CHECKs rather than a partial one.
  items_fit_length: '핏 표기가 너무 길어요.',
  items_price_max: '가격이 너무 커요.',
  items_purchase_place_length: '구매처가 너무 길어요.',
  items_tags_limit: '태그가 너무 많아요.',
  items_tags_element_length: '태그 하나가 너무 길어요.',
  items_tags_distinct: '같은 태그가 중복됐어요.',
  items_colors_limit: '색상은 3개까지 고를 수 있어요.',
  items_colors_distinct: '같은 색상이 중복됐어요.',
  items_colors_valid: '지원하지 않는 색상이에요.',
  items_seasons_limit: '계절이 너무 많이 선택됐어요.',
  items_seasons_distinct: '같은 계절이 중복됐어요.',
  items_seasons_valid: '지원하지 않는 계절이에요.',
  items_category_group_valid: '카테고리를 다시 골라주세요.',
  items_price_non_negative: '가격은 0원 이상이어야 해요.',
  items_title_not_blank: '이름을 입력해주세요.',
  items_status_valid: '보유 상태 값이 올바르지 않아요.',
  item_images_sort_order_range: '사진은 최대 5장까지예요.',
  item_images_path_not_blank: '사진 경로가 비어 있어요.',
  item_images_dimensions_positive: '사진 크기를 읽지 못했어요.',
  item_images_item_sort_key: '사진 순서가 중복됐어요.',
  item_images_item_fk: '사진을 붙일 옷을 찾을 수 없어요.',
  // The wear log's three, and none of them currently reaches a screen.
  //
  // The two unique ones because nothing writes in a way that can trip them:
  // `set_item_wears` is `on conflict do nothing` and the single toggle is an
  // `ignoreDuplicates` upsert.
  //
  // The foreign key is different — it fires in ordinary use, when a submit
  // carries a garment another device has deleted — but the wardrobe screen now
  // reads its SQLSTATE first. A 23503 there means the collection is stale, so
  // that screen refetches and writes a sentence about *that* instead of asking
  // this map for one. The detail screen's wear toggle never asks either; its
  // failure toast is a fixed string.
  //
  // Listed anyway, for the reason the fit entry above is: this map is a mirror
  // of the schema, and deciding which unreachable names to leave out is the
  // judgement that put gaps in it three times.
  item_wears_item_date_key: '그날 입은 옷으로 이미 기록돼 있어요.',
  item_wears_item_fk: '착용 기록을 붙일 옷을 찾을 수 없어요.',
  items_id_user_key: '이미 있는 옷이에요.',
  items_user_id_fkey: '계정을 찾을 수 없어요. 다시 로그인해주세요.',
  items_pkey: '이미 있는 옷이에요.',
  item_images_pkey: '이미 있는 사진이에요.',
  item_wears_pkey: '이미 있는 착용 기록이에요.',
}

/** Exported for the coverage test; not part of the public surface otherwise. */
export const MAPPED_CONSTRAINTS = Object.keys(CONSTRAINT_MESSAGES)

/**
 * By SQLSTATE, for violations that carry no constraint name to look up.
 *
 * `23502` is the one that matters: NOT NULL is not a row in `pg_constraint` on
 * Postgres 17, so it is absent from the generated inventory and from the map
 * above, and its message — `null value in column "title" of relation "items"
 * violates not-null constraint` — quotes the column, not a constraint. Nothing
 * in `CONSTRAINT_MESSAGES` could ever match it, which left the last path that
 * put raw English on a Korean screen.
 */
const CODE_MESSAGES: Record<string, string> = {
  '22003': '숫자가 너무 커요.', // numeric_value_out_of_range
  '23502': '필수 항목이 비어 있어요.', // not_null_violation
  '23503': '연결된 항목을 찾을 수 없어요.', // foreign_key_violation
  '23505': '이미 있는 항목이에요.', // unique_violation
  '42501': '권한이 없어요.', // insufficient_privilege
}

/**
 * Postgres always quotes the constraint name, so pull it out and look it up.
 *
 * Scanning the table for a substring hit worked while the names happened to be
 * unrelated, but the map is generated now and only grows: the first entry that
 * is a prefix of a longer name would win on insertion order alone, silently
 * returning the wrong sentence. Extracting first makes the lookup exact and
 * removes the ordering dependency nothing was testing.
 */
function friendly(message: string, code: unknown): string | null {
  const named = /constraint "([^"]+)"/.exec(message)?.[1]
  if (named && named in CONSTRAINT_MESSAGES) return CONSTRAINT_MESSAGES[named]
  if (typeof code === 'string' && code in CODE_MESSAGES) return CODE_MESSAGES[code]
  return null
}

/**
 * Whether a data-layer failure carries this SQLSTATE.
 *
 * For the callers that need to *do* something about a specific failure rather
 * than describe it — the wear submit refetches the wardrobe on `23503`, because
 * a foreign key violation there means the collection it built the request from
 * is behind the database.
 *
 * By code and not by matching the message, which is the same reason the lookup
 * above extracts the constraint name instead of scanning for a substring: the
 * text is Postgres's and can be reworded, the code cannot.
 */
export function hasErrorCode(error: unknown, code: string): boolean {
  return error != null && typeof error === 'object' && (error as { code?: unknown }).code === code
}

export function errorMessage(error: unknown, fallback = '알 수 없는 오류'): string {
  if (typeof error === 'string') return error

  if (error && typeof error === 'object' && 'message' in error) {
    const { message, code } = error as { message?: unknown; code?: unknown }
    if (typeof message === 'string' && message.trim()) {
      return friendly(message, code) ?? message
    }
  }

  // Reached only by an Error whose message is empty — the branch above already
  // handles every Error with text, because `message` is an own property. Without
  // the `||` this returned '' and the screen rendered a label with nothing after
  // it.
  if (error instanceof Error) return error.message || fallback
  return fallback
}
