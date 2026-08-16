import { errorMessage } from '@/shared/lib/errorMessage'
import { getSupabase, isSupabaseConfigured, STORAGE_BUCKET } from './supabase'

/**
 * 위 계층에서 본 사진 버킷.
 *
 * 여기서는 옷이 무엇인지 모른다 — 경로를 서명하고 객체를 지울 뿐이다. 옷장 목록(커버
 * 썸네일)과 상세 화면(원본)이 같은 두 연산을 필요로 해서 호출부가 아니라 클라이언트 옆에 둔다.
 */

/**
 * 서명 URL의 수명. 비공개 버킷이라 모든 이미지가 서명을 거친다.
 *
 * 네 시간에 `refetchOnWindowFocus`를 짝지어, 백그라운드에 있던 PWA로 돌아오면 다시
 * 서명된다. 포커스를 한 번도 잃지 않은 채 네 시간을 넘긴 탭은 새로고침이 필요하고,
 * 그것이 비공개 버킷에 하루짜리 URL을 내주지 않는 대가다.
 */
export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 4

/**
 * 아래 쿼리의 캐시 키. 키와 그것이 가리키는 요청이 함께 움직이도록 fetcher 옆에 둔다.
 *
 * 경로가 키의 일부라, 집합이 다르면 다른 엔트리가 되고 URL이 엉뚱한 사진에 붙을 수 없다.
 * 순서도 의미가 있다 — 호출부가 결과를 위치로 사진에 맞춘다. react-query가 키를 값으로
 * 해싱하므로 매 렌더 새 배열을 넘겨도 된다.
 */
export const storageKeys = {
  signedUrls: (paths: readonly string[]) => ['storage', 'signed-urls', paths] as const,
} as const

/** 경로 묶음을 서명해 성공한 것만 path → URL로 돌려준다. */
export async function signPaths(paths: readonly string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (paths.length === 0) return result

  const { data, error } = await getSupabase()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrls([...paths], SIGNED_URL_TTL_SECONDS)

  if (error) throw error

  for (const entry of data ?? []) {
    // createSignedUrls는 경로별 실패를 던지지 않고 결과에 실어 보낸다 — 객체 하나가
    // 없다고 격자 전체가 비지 않는다.
    if (entry.signedUrl && entry.path) result.set(entry.path, entry.signedUrl)
  }
  return result
}

/**
 * settled된 supabase-js 호출 안의 실패. 없으면 `null`.
 *
 * **supabase-js는 reject보다 `{ error }`로 훨씬 자주 답한다.** 네트워크가 끊겨도
 * 업로드나 삭제가 *resolve*되면서 `StorageUnknownError`를 싣는다. StorageError가
 * 아예 아닌 것만 rejection으로 빠져나온다.
 *
 * 두 모양을 모두 답하고, 호출부는 truthy가 아니라 `null`과 비교한다 — `''`나 `0`을
 * 실은 rejection도 실패다.
 */
export function settledError(result: PromiseSettledResult<{ error: unknown }>): unknown {
  if (result.status === 'rejected') return result.reason ?? new Error('알 수 없는 이유')
  return result.value.error ?? null
}

/**
 * API가 답한 것인가, 요청이 애초에 닿지 않은 것인가.
 *
 * `StorageApiError`는 만들어진 HTTP 상태를 싣고, 끊긴 연결이 만드는
 * `StorageUnknownError`는 싣지 않는다.
 */
function isApiFailure(failure: unknown): boolean {
  return typeof (failure as { status?: unknown } | null)?.status === 'number'
}

/**
 * 최선을 다하는 스토리지 정리. **절대 던지지 않고**, 자신을 부른 에러를 가리지도 않는다.
 *
 * 던지지 않는 것이 계약의 전부이고 세 호출부 모두에서 그것이 필요하다. 둘은 정리 후 진짜
 * 실패를 다시 던지는 `catch` 블록이라 여기서 던지면 이유가 청소부의 것으로 바뀐다.
 * 셋째는 행이 이미 사라진 `deleteItem`의 마지막 줄이라, 던지면 정말로 지워진 옷에
 * "삭제하지 못했어요"가 뜬다.
 *
 * 그래서 모든 호출이 `allSettled`를 거친다. 설정 검사도 같은 약속의 일부다 —
 * `getSupabase()`가 환경변수 없이 던지는 유일한 줄이고, 애초에 없는 버킷에는 지울 것도 없다.
 */
export async function removeObjects(paths: readonly string[]): Promise<void> {
  if (paths.length === 0 || !isSupabaseConfigured) return
  const storage = getSupabase().storage.from(STORAGE_BUCKET)

  const [batch] = await Promise.allSettled([storage.remove([...paths])])
  const batchFailure = settledError(batch)
  if (batchFailure === null) return

  /**
   * API가 실제로 답했을 때만.
   *
   * 아래 재시도는 한 가지 모양을 위한 것이다 — 잘못된 키 하나 때문에 묶음 전체가
   * 거부되어 멀쩡한 키까지 끌려간 경우. 닿지도 않은 요청을 경로마다 다시 보내는 것은
   * 같은 이유로 죽을 뿐이고, 그동안 화면에는 이미 지워진 행에 "삭제 중…"이 떠 있다.
   */
  if (!isApiFailure(batchFailure)) {
    console.warn('스토리지 정리 실패, 고아 객체가 남았을 수 있음:', errorMessage(batchFailure))
    return
  }

  /**
   * 키 하나가 나머지의 값을 치르면 안 된다.
   *
   * 호출부는 경로를 낙관적으로 적는다 — 실패한 업로드가 객체를 남겼는지 아닌지 알 수
   * 없으므로 없을 수도 있는 키를 일부러 넘긴다. 없는 키 때문에 묶음이 거부되면 실제로
   * 있는 객체까지 함께 살아남는다. 호출부가 피하려던 바로 그 고아다.
   */
  const results = await Promise.allSettled(paths.map((path) => storage.remove([path])))
  // 묶음이 아니라 재시도 결과로 보고한다. 없는 키 *때문에* 거부된 묶음의 메시지는
  // 실제로 남은 객체에 대해 아무 말도 하지 않는다.
  const left = results
    .map((result, index) => ({ path: paths[index], failure: settledError(result) }))
    .filter((entry) => entry.failure !== null)

  if (left.length > 0) {
    console.warn(
      `스토리지 정리 실패, 고아 객체 ${left.length}건이 남았을 수 있음:`,
      // `String()`이 아니라 `errorMessage` — Supabase가 Error가 아닌 평범한 객체로
      // 답할 때 `String()`은 "[object Object]"를 그린다.
      left.map((entry) => `${entry.path}: ${errorMessage(entry.failure)}`).join(', '),
    )
  }
}
