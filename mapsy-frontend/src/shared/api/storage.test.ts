import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { removeObjects } from './storage'

/**
 * Cleanup is best-effort, and "best-effort" has been got wrong twice here in
 * opposite directions — once by letting the call throw, once by retrying a dead
 * network path by path. Both are invisible from the call sites, and one of them
 * reported an already-deleted garment to the user as a failed delete.
 *
 * The shapes below are what supabase-js 2.111.0 actually produces, measured
 * against a live client: a request that never arrives *resolves* carrying a
 * `StorageUnknownError` with no `status`, and an API refusal resolves carrying a
 * `StorageApiError` with a numeric one.
 */

const unreachable = () => Object.assign(new Error('fetch failed'), { __isStorageError: true })
const refused = () =>
  Object.assign(new Error('Invalid key'), { __isStorageError: true, status: 400 })

const { remove } = vi.hoisted(() => ({ remove: vi.fn() }))

vi.mock('./supabase', () => ({
  isSupabaseConfigured: true,
  STORAGE_BUCKET: 'wardrobe',
  getSupabase: () => ({ storage: { from: () => ({ remove }) } }),
}))

// Re-spied per test rather than once for the file: `mockRestore` un-spies for
// good, so a single spy plus an `afterEach` restore silently stops recording
// after the first test — and every assertion about warnings then passes or fails
// for the wrong reason.
const silenceWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => {})
let warn: ReturnType<typeof silenceWarnings>

beforeEach(() => {
  remove.mockReset()
  warn = silenceWarnings()
})

afterEach(() => {
  warn.mockRestore()
})

describe('removeObjects', () => {
  it('한 번에 지워지면 한 번만 부른다', async () => {
    remove.mockResolvedValue({ data: [], error: null })

    await removeObjects(['a.webp', 'a_thumb.webp'])

    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith(['a.webp', 'a_thumb.webp'])
    expect(warn).not.toHaveBeenCalled()
  })

  it('API가 거절하면 경로별로 다시 시도한다', async () => {
    // 폴백이 존재하는 이유: 키 하나 때문에 배치가 통째로 거절당하면, 실제로
    // 존재하는 객체까지 안 지워진다.
    remove.mockResolvedValueOnce({ data: null, error: refused() })
    remove.mockResolvedValue({ data: [], error: null })

    await removeObjects(['a.webp', 'a_thumb.webp'])

    expect(remove).toHaveBeenCalledTimes(3)
    expect(remove).toHaveBeenNthCalledWith(2, ['a.webp'])
    expect(remove).toHaveBeenNthCalledWith(3, ['a_thumb.webp'])
    // 재시도가 전부 성공했으면 남은 고아가 없으므로 조용해야 한다.
    expect(warn).not.toHaveBeenCalled()
  })

  it('네트워크가 죽었으면 경로별로 다시 시도하지 않는다', async () => {
    // 재시도해도 같은 이유로 죽는다. deleteItem이 이걸 await하고 화면에는
    // "삭제 중…"이 떠 있는데, 행은 이미 지워진 뒤다.
    remove.mockResolvedValue({ data: null, error: unreachable() })

    await removeObjects(['a.webp', 'a_thumb.webp', 'b.webp'])

    expect(remove).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('supabase-js가 실제로 reject해도 던지지 않는다', async () => {
    // 세 호출부의 계약. 둘은 catch 안에서 부르고 진짜 실패를 다시 던지며,
    // 하나는 이미 지워진 행 뒤에서 부른다.
    remove.mockRejectedValue(new Error('무언가 터짐'))

    await expect(removeObjects(['a.webp'])).resolves.toBeUndefined()
  })

  it('지울 게 없으면 아무것도 부르지 않는다', async () => {
    await removeObjects([])
    expect(remove).not.toHaveBeenCalled()
  })
})
