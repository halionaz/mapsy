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
 * Constraint names carry the intent, so they map to something a person can act
 * on. The form mirrors these limits and normally catches them first; this is the
 * surface left over for anything that slips past, and it should not be raw
 * Postgres text on a Korean screen.
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
  item_images_sort_order_range: '사진은 최대 5장까지예요.',
}

const CODE_MESSAGES: Record<string, string> = {
  '22003': '숫자가 너무 커요.', // numeric_value_out_of_range
  '23505': '이미 있는 항목이에요.', // unique_violation
  '23503': '연결된 항목을 찾을 수 없어요.', // foreign_key_violation
  '42501': '권한이 없어요.', // insufficient_privilege
}

function friendly(message: string, code: unknown): string | null {
  for (const [name, text] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (message.includes(name)) return text
  }
  if (typeof code === 'string' && code in CODE_MESSAGES) return CODE_MESSAGES[code]
  return null
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
