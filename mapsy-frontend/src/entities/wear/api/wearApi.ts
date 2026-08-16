import { getSupabase } from '@/shared/api/supabase'
import { warnIfTruncated } from '@/shared/api/warnIfTruncated'
import type { WearEntry } from '../model/types'

/**
 * 착용 기록의 Supabase 접근.
 *
 * `itemApi`처럼 읽기·쓰기에 소유자 조건이 없다 — 정책이 모든 행을 `auth.uid()`로 좁힌다.
 *
 * `removeWear`는 예외이고 `deleteItem`과는 다른 이유다. `item_id`와 `worn_on`을 부르는 것은
 * 그 짝이 행의 *정체*이기 때문이다. 지울 id 자체가 없고, 유니크 제약이 같은 사실을 말한다.
 */

/**
 * 전량 로드의 상한. 짧은 답을 잡아내는 것은 이 한도가 아니라 `count: 'exact'`다 —
 * `warnIfTruncated` 참고.
 *
 * 하루 네 벌씩 10년이면 14,600행쯤이므로, 통째로 받을 만한 어떤 옷장보다도 위에 있다.
 */
const WEAR_FETCH_LIMIT = 20000

export async function fetchWears(): Promise<WearEntry[]> {
  // `*`가 아니라 두 컬럼. 행 수가 한없이 자라는 유일한 쿼리다 — 다른 테이블은 가진
  // 옷의 수로 묶인다 — 그래서 아무도 읽지 않는 세 컬럼은 매 로드마다 영원히 실리는 짐이다.
  const { data, error, count } = await getSupabase()
    .from('item_wears')
    .select('item_id, worn_on', { count: 'exact' })
    .order('worn_on', { ascending: false })
    .limit(WEAR_FETCH_LIMIT)

  if (error) throw error
  warnIfTruncated(data?.length ?? 0, count, '착용 기록')

  return (data ?? []).map((row) => ({ itemId: row.item_id, wornOn: row.worn_on }))
}

/**
 * 하루를 정확히 이 옷들로 다시 쓴다.
 *
 * delete 후 insert가 아니라 DB 함수를 거친다. PostgREST 요청은 각각이 트랜잭션이라,
 * delete가 들어가고 insert가 실패하면 그날의 기록이 재시도할 것도 없이 지워진다.
 * 함수는 둘 다 하거나 둘 다 안 한다.
 */
export async function setWears(wornOn: string, itemIds: string[]): Promise<void> {
  const { error } = await getSupabase().rpc('set_item_wears', {
    p_worn_on: wornOn,
    p_item_ids: itemIds,
  })
  if (error) throw error
}

/**
 * 옷 하나를 하루에 기록한다.
 *
 * `insert`가 아니라 `ignoreDuplicates` upsert다. 유니크 제약이 같은 날 두 번 기록하는 것을
 * 설계상 무효 연산으로 만드는데, 평범한 insert는 그것을 호출부가 알아보고 삼켜야 하는
 * 23505로 바꾼다 — 상세 화면이 두 기기에 열려 있으면 정당하게 지는 경합이다.
 */
export async function addWear(itemId: string, userId: string, wornOn: string): Promise<void> {
  const { error } = await getSupabase()
    .from('item_wears')
    .upsert(
      { item_id: itemId, user_id: userId, worn_on: wornOn },
      { onConflict: 'item_id,worn_on', ignoreDuplicates: true },
    )
  if (error) throw error
}

export async function removeWear(itemId: string, wornOn: string): Promise<void> {
  const { error } = await getSupabase()
    .from('item_wears')
    .delete()
    .eq('item_id', itemId)
    .eq('worn_on', wornOn)
  if (error) throw error
}
