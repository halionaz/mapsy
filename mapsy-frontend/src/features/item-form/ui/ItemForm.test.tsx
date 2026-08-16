/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PhotoEntry } from '@/entities/item'
import type { ProcessedPhoto } from '@/shared/lib/image'
import { ItemForm } from './ItemForm'

/**
 * The two rules that changed when the edit screen started showing photos.
 *
 * Photos used to be registration-only, which made both of these registration's
 * problem alone: "at least one photo" was a rule about a form that started
 * empty, and handing the blobs over was a handoff to a store that always took
 * them. Editing can now take the last photo away, and its save can come back
 * refused with the form still on screen.
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
  it('refuses a save that would leave the garment with no photo', () => {
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

    // The database refuses the same thing — an item with no photos is a blank
    // card on the grid. This is the half that says so before anything uploads.
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.queryByText('사진을 한 장 이상 추가해주세요.')).not.toBeNull()
  })

  it('takes its previews back when the save is refused, and frees them on the way out', () => {
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

    // The save failed, so nobody took the blobs: leaving now has to free them.
    rerender(<ItemForm {...props} error="저장하지 못했어요." />)
    unmount()

    expect(releasePreviewMock).toHaveBeenCalledTimes(1)
  })
})
