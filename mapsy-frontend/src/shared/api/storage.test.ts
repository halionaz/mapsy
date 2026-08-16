import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { removeObjects } from './storage'

/**
 * 정리는 최선을 다하는 일이고, "최선"이 여기서 반대 방향으로 두 번 틀렸다 — 한 번은
 * 호출이 던지게 두어서, 한 번은 끊긴 네트워크를 경로마다 다시 시도해서. 둘 다 호출부에서는
 * 보이지 않고, 그중 하나는 이미 지워진 옷을 삭제 실패로 사용자에게 알렸다.
 *
 * 아래 모양은 supabase-js가 실제로 만드는 것이다 — 닿지 않은 요청은 `status`가 없는
 * `StorageUnknownError`를 실어 *resolve*하고, API 거부는 숫자 status를 가진
 * `StorageApiError`를 실어 resolve한다.
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

// 파일에 한 번이 아니라 테스트마다 다시 spy를 건다. `mockRestore`는 spy를 영영 떼므로,
// spy 하나에 `afterEach` 복원을 붙이면 첫 테스트 뒤로 조용히 기록을 멈추고 경고에 대한
// 모든 단언이 틀린 이유로 통과하거나 실패한다.
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
