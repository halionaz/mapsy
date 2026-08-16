/**
 * 전량 로드가 짧게 돌아온 것을 잡는다.
 *
 * PostgREST는 `max-rows`에서 **조용히** 자른다 — 에러가 아니라 짧은 배열이다. 우리가
 * `.limit()`을 걸어도 드러나지 않는다. 서버 상한이 더 낮으면 응답은 우리 한도 아래라
 * 완전해 보인다.
 *
 * 잡아내는 것은 `count: 'exact'`다. 몇 행이 왔는지와 무관하게 전체 행 수가 실려 오므로
 * 둘을 비교하면 어느 쪽에서 잘렸든 걸린다.
 */
export function warnIfTruncated(received: number, total: number | null, what: string): void {
  if (total == null || received >= total) return
  console.warn(
    `${what} ${total}건 중 ${received}건만 받음. 전량 로드 + 클라이언트 필터링의 한계에 ` +
      '도달했으므로 서버 사이드 필터링으로 전환해야 함 (PRD §8.4).',
  )
}
