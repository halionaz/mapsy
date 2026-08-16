/**
 * 데이터 계층이 던진 것을 사람이 읽을 문장으로.
 *
 * Supabase의 쿼리 결과는 Error가 아니라 평범한 `{ message, details, hint, code }`
 * 객체를 싣는다 — 클라이언트가 `PostgrestError`를 만드는 것은 이 앱이 쓰지 않는
 * `throwOnError` 경로뿐이다. 그래서 `instanceof Error`가 거짓이고 `String(error)`는
 * "[object Object]"가 된다.
 */

/**
 * `public` 스키마의 모든 제약을, 사람이 대응할 수 있는 말로.
 *
 * 닿을 법한 것만이 아니라 전부다 — 어떤 도달 불가능한 이름을 뺄지 고르는 판단이 여기에
 * 구멍을 냈다. 손으로 관리하지도 않는다. `dbConstraints.generated.ts`가 `pnpm test:db`로
 * 스키마에서 생성되고, 이 표가 그것을 덮지 않으면 단위 테스트가 깨진다.
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  items_title_length: '이름이 너무 길어요.',
  items_memo_length: '메모가 너무 길어요.',
  items_brand_length: '브랜드 이름이 너무 길어요.',
  items_size_length: '사이즈 표기가 너무 길어요.',
  // 핏은 프리셋 칩에서만 오므로 오늘은 닿지 않는다 — 표를 CHECK의 완전한 거울로
  // 두기 위해 적어 둔다.
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
  // 착용 기록의 셋. 지금은 어느 것도 화면에 닿지 않는다 — 유니크 둘은 쓰기가
  // `on conflict do nothing`과 `ignoreDuplicates` upsert라 걸릴 수 없고, 외래키는
  // 실제로 울리지만 옷장 화면이 SQLSTATE를 먼저 읽어 자기 문장을 쓴다.
  item_wears_item_date_key: '그날 입은 옷으로 이미 기록돼 있어요.',
  item_wears_item_fk: '착용 기록을 붙일 옷을 찾을 수 없어요.',
  items_id_user_key: '이미 있는 옷이에요.',
  items_user_id_fkey: '계정을 찾을 수 없어요. 다시 로그인해주세요.',
  items_pkey: '이미 있는 옷이에요.',
  item_images_pkey: '이미 있는 사진이에요.',
  item_wears_pkey: '이미 있는 착용 기록이에요.',
}

/** 커버리지 테스트용 노출. */
export const MAPPED_CONSTRAINTS = Object.keys(CONSTRAINT_MESSAGES)

/**
 * 찾아볼 제약 이름이 없는 위반을 위한 SQLSTATE 표.
 *
 * `23502`가 그 이유다. NOT NULL은 Postgres 17의 `pg_constraint`에 행이 없어 생성된
 * 목록에도 위 표에도 없고, 메시지가 제약이 아니라 컬럼을 인용한다.
 */
const CODE_MESSAGES: Record<string, string> = {
  '22003': '숫자가 너무 커요.', // numeric_value_out_of_range
  '23502': '필수 항목이 비어 있어요.', // not_null_violation
  '23503': '연결된 항목을 찾을 수 없어요.', // foreign_key_violation
  '23505': '이미 있는 항목이에요.', // unique_violation
  '42501': '권한이 없어요.', // insufficient_privilege
}

/**
 * Postgres는 늘 제약 이름을 따옴표로 싣는다. 뽑아서 정확히 찾는다.
 *
 * 표를 부분 문자열로 훑으면, 어떤 이름이 더 긴 이름의 접두사일 때 삽입 순서만으로
 * 이기고 조용히 틀린 문장을 돌려준다.
 */
function friendly(message: string, code: unknown): string | null {
  const named = /constraint "([^"]+)"/.exec(message)?.[1]
  if (named && named in CONSTRAINT_MESSAGES) return CONSTRAINT_MESSAGES[named]
  if (typeof code === 'string' && code in CODE_MESSAGES) return CODE_MESSAGES[code]
  return null
}

/**
 * 이 실패가 그 SQLSTATE를 싣고 있는지.
 *
 * 실패를 설명하는 대신 *무언가 해야 하는* 호출부용이다 — 착용 기록 제출은 `23503`에
 * 옷장을 다시 불러온다. 메시지가 아니라 코드로 보는 이유는 문구는 Postgres 것이고
 * 바뀔 수 있지만 코드는 아니기 때문.
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

  // 메시지가 빈 Error만 여기 닿는다. `||`가 없으면 ''를 돌려주고 화면에는 라벨만 남는다.
  if (error instanceof Error) return error.message || fallback
  return fallback
}
