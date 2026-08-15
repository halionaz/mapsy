/**
 * Detects a full-collection fetch that came back short.
 *
 * PostgREST truncates to its configured `max-rows` **silently** — a shorter
 * array, not an error. Setting our own `.limit()` does not reveal that: if the
 * server's ceiling is the lower of the two, the response is under our limit and
 * looks complete.
 *
 * `count: 'exact'` is what actually detects it. The response carries the total
 * row count independently of how many rows came back, so comparing the two
 * catches truncation from either source — and incidentally reports what the
 * server's ceiling really is.
 *
 * Shared because the reasoning is, not because the two call sites are alike:
 * both the wardrobe and the wear log bet on loading everything and filtering in
 * memory (PRD §8.4), and the only thing standing between that bet and a
 * silently half-drawn screen is this comparison being made at all.
 */
export function warnIfTruncated(received: number, total: number | null, what: string): void {
  if (total == null || received >= total) return
  console.warn(
    `${what} ${total}건 중 ${received}건만 받음. 전량 로드 + 클라이언트 필터링의 한계에 ` +
      '도달했으므로 서버 사이드 필터링으로 전환해야 함 (PRD §8.4).',
  )
}
