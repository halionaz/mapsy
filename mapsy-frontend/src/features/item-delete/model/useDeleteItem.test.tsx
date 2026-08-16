/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useDeleteItem } from './useDeleteItem'

/**
 * 옷을 지우면 캐시를 하나가 아니라 둘 비워야 한다.
 *
 * 옷장 쪽 절반은 `entities/item`의 테스트가, `dropItemWears`가 맞는 행을 지우는지는
 * `entities/wear`의 테스트가 본다. 여기가 붙드는 것은 그 둘이 실제로 엮여 있다는 것이다 —
 * 행 삭제가 끝난 뒤 같은 client와 같은 id로 착용 캐시가 정리되는가.
 */

const { deleteRowMock, dropItemWearsMock } = vi.hoisted(() => ({
  deleteRowMock: vi.fn().mockResolvedValue(undefined),
  dropItemWearsMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/entities/item', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/item')>()),
  useDeleteItemRow: () => ({ mutateAsync: deleteRowMock }),
}))

vi.mock('@/entities/wear', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/wear')>()),
  dropItemWears: dropItemWearsMock,
}))

describe('useDeleteItem', () => {
  it('행을 지운 뒤 그 옷의 착용 기록을 캐시에서 걷어낸다', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    const { result } = renderHook(() => useDeleteItem(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })

    await result.current.mutateAsync({ id: 'a', userId: 'u1' })

    expect(deleteRowMock).toHaveBeenCalledWith({ id: 'a', userId: 'u1' })
    // 아무 client가 아니라 같은 client — 두 번째 QueryClient에 대한 호출은 아무 화면도
    // 읽지 않는 엔트리를 기운다.
    expect(dropItemWearsMock).toHaveBeenCalledWith(client, 'a')
  })
})
