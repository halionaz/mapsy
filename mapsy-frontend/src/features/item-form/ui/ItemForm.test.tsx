/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PhotoEntry } from '@/entities/item'
import type { ProcessedPhoto } from '@/shared/lib/image'
import { ItemForm } from './ItemForm'

/**
 * 편집 화면이 사진을 보여주기 시작하면서 바뀐 두 규칙.
 *
 * 사진이 등록 전용이던 시절에는 둘 다 등록만의 문제였다 — "사진 최소 한 장"은 비어서
 * 시작하는 폼에 대한 규칙이었고, blob을 넘기는 것은 늘 받아주는 스토어로의 인계였다.
 * 이제 편집이 마지막 사진을 뺄 수 있고, 그 저장이 폼이 화면에 남은 채 거절돼 돌아올 수 있다.
 */

const { releasePreviewMock } = vi.hoisted(() => ({ releasePreviewMock: vi.fn() }))

vi.mock('@/shared/lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/image')>()),
  releasePreview: releasePreviewMock,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function stored(id: string): PhotoEntry {
  return {
    kind: 'stored',
    image: {
      id,
      itemId: 'i1',
      userId: 'u1',
      path: `${id}.webp`,
      thumbPath: `${id}_thumb.webp`,
      sortOrder: 0,
      width: 1280,
      height: 960,
      createdAt: '2026-08-01T00:00:00Z',
    },
  }
}

function picked(previewUrl: string): PhotoEntry {
  const blob = new Blob()
  const photo: ProcessedPhoto = {
    full: blob,
    thumb: blob,
    width: 1,
    height: 1,
    ext: 'webp',
    previewUrl,
  }
  return { kind: 'picked', photo }
}

describe('ItemForm', () => {
  it('사진 없는 옷을 만드는 저장을 거절한다', () => {
    const onSubmit = vi.fn()
    render(
      <ItemForm
        initial={{ title: '마산 플리스', categoryId: 'top.knit', photos: [] }}
        submitLabel="저장"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    // DB도 같은 것을 거절한다 — 사진 없는 옷은 격자의 빈 카드다. 이쪽은 아무것도
    // 올라가기 전에 그것을 말하는 절반이다.
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.queryByText('사진을 한 장 이상 추가해주세요.')).not.toBeNull()
  })

  /**
   * 저장이 사진 목록을 다시 써도 되는지.
   *
   * 폼에서 알리는 것은 사람이 실제로 건드린 것이 폼이기 때문이다. 뻔한 대안인 "제출된
   * 목록을 옷장 캐시와 비교"는, 이 화면이 열려 있는 동안 *다른 기기*가 더한 사진을
   * 여기서 한 편집으로 읽고 재작성이 그것을 지운다. 사용자는 본 적도 없는데 토스트는
   * 저장했어요라고 말한다.
   */
  it('텍스트만 고친 편집은 사진을 건드리지 않았다고 알린다', () => {
    const onSubmit = vi.fn()
    render(
      <ItemForm
        initial={{
          title: '마산 플리스',
          categoryId: 'top.knit',
          photos: [stored('a'), stored('b')],
        }}
        submitLabel="저장"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ photosChanged: false }))
  })

  it('재정렬은 변경으로 알린다', () => {
    const onSubmit = vi.fn()
    render(
      <ItemForm
        initial={{
          title: '마산 플리스',
          categoryId: 'top.knit',
          photos: [stored('a'), stored('b')],
        }}
        submitLabel="저장"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    const tile = screen.getByLabelText('사진 2')
    fireEvent.keyDown(tile, { key: ' ' })
    fireEvent.keyDown(tile, { key: 'ArrowLeft' })
    fireEvent.keyDown(tile, { key: ' ' })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ photosChanged: true }))
  })

  it('저장이 거절되면 미리보기를 되받고, 떠날 때 반납한다', () => {
    const onSubmit = vi.fn()
    const props = {
      initial: { title: '마산 플리스', photos: [picked('blob:new')] },
      submitLabel: '저장',
      onSubmit,
      onCancel: vi.fn(),
    }
    const { rerender, unmount } = render(<ItemForm {...props} />)

    fireEvent.click(screen.getByRole('button', { name: '니트/스웨터' }))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)

    // 저장이 실패했으니 아무도 blob을 가져가지 않았다 — 지금 떠나면 반납해야 한다.
    rerender(<ItemForm {...props} error="저장하지 못했어요." />)
    unmount()

    expect(releasePreviewMock).toHaveBeenCalledTimes(1)
  })
})
