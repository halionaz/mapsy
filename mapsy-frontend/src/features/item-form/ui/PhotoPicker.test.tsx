/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PhotoEntry } from '@/entities/item'
import type { ProcessedPhoto } from '@/shared/lib/image'
import { PhotoPicker } from './PhotoPicker'

/**
 * The tiles the edit screen added: photos that are already in storage, sitting
 * in the same row as ones picked a second ago.
 *
 * Two of these are things the type checker cannot see. A stored photo has no
 * object URL, so releasing one on removal would throw away nothing while a
 * picked one left unreleased leaks its blob for the life of the tab — and both
 * happen in the same three-line function. And a signed URL arrives later than
 * the tile does, so "not here yet" and "did not arrive" have to stay apart, or a
 * cold open reads as five broken photos.
 */

const { releasePreviewMock, processPhotoMock } = vi.hoisted(() => ({
  releasePreviewMock: vi.fn(),
  processPhotoMock: vi.fn(),
}))

vi.mock('@/shared/lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/image')>()),
  releasePreview: releasePreviewMock,
  // jsdom has no canvas, and what these tests need from it is timing anyway.
  processPhoto: processPhotoMock,
}))

/**
 * The one thing jsdom cannot answer: how big the grid came out.
 *
 * Only the measurement is replaced — three columns of 84px tiles with a 12px
 * gap, which is what the stylesheet asks for on a phone — so everything the
 * drag decides from it is still the real code deciding it.
 */
vi.mock('../lib/photoGrid', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/photoGrid')>()),
  readGridGeometry: () => ({ pitch: 96, columns: 3, left: 0, top: 0 }),
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

/** The photo inside a tile, reached through the tile's own name. */
function srcOf(label: string): string | null | undefined {
  return screen.getByLabelText(label).querySelector('img')?.getAttribute('src')
}

describe('PhotoPicker', () => {
  it('draws a stored photo from its signed URL and a picked one from its preview', () => {
    render(
      <PhotoPicker
        photos={[stored('a'), picked('blob:new')]}
        onChange={vi.fn()}
        storedUrls={new Map([['a', 'signed://a']])}
      />,
    )

    expect(srcOf('사진 1')).toBe('signed://a')
    expect(srcOf('사진 2')).toBe('blob:new')
  })

  it('keeps "still coming" apart from "did not arrive"', () => {
    const { rerender } = render(
      <PhotoPicker photos={[stored('a')]} onChange={vi.fn()} storedUrls={new Map()} />,
    )

    // No entry yet: the URL is still being signed. A failure notice here would
    // be the ordinary cold open telling the user their photo is gone.
    expect(screen.queryByText('불러오지 못함')).toBeNull()

    rerender(
      <PhotoPicker photos={[stored('a')]} onChange={vi.fn()} storedUrls={new Map([['a', null]])} />,
    )
    expect(screen.queryByText('불러오지 못함')).not.toBeNull()
  })

  it('releases the preview of a removed picked photo, and only that', () => {
    const onChange = vi.fn()
    const entries = [stored('a'), picked('blob:new')]
    const { rerender } = render(
      <PhotoPicker photos={entries} onChange={onChange} storedUrls={new Map([['a', 'signed://a']])} />,
    )

    // A stored photo is only dropped from the list here; it is deleted for real
    // when the form is saved, and it has no object URL to give back.
    fireEvent.click(screen.getByLabelText('사진 1 삭제'))
    expect(releasePreviewMock).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenLastCalledWith([entries[1]])

    rerender(
      <PhotoPicker
        photos={[entries[1]]}
        onChange={onChange}
        storedUrls={new Map([['a', 'signed://a']])}
      />,
    )
    fireEvent.click(screen.getByLabelText('사진 1 삭제'))
    expect(releasePreviewMock).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('moves the 대표 badge with the tile, not with the list', () => {
    // Dragging a photo to the front *is* how the cover changes, so a badge that
    // waits for the drop sits on the wrong tile for the whole gesture.
    render(
      <PhotoPicker
        photos={[stored('a'), stored('b'), stored('c')]}
        onChange={vi.fn()}
        storedUrls={new Map()}
      />,
    )

    const third = screen.getByLabelText('사진 3')
    fireEvent.keyDown(third, { key: ' ' })
    fireEvent.keyDown(third, { key: 'ArrowLeft' })
    fireEvent.keyDown(third, { key: 'ArrowLeft' })

    expect(screen.getByText('대표').parentElement?.contains(third)).toBe(true)
  })

  it('rearranges from the keyboard, since dragging is the only other way in', () => {
    const onChange = vi.fn()
    const entries = [stored('a'), picked('blob:new')]
    render(<PhotoPicker photos={entries} onChange={onChange} storedUrls={new Map()} />)

    const tile = screen.getByLabelText('사진 2')
    fireEvent.keyDown(tile, { key: ' ' })
    expect(tile.getAttribute('aria-pressed')).toBe('true')

    fireEvent.keyDown(tile, { key: 'ArrowLeft' })
    // Still nothing committed — the list is rewritten when it is put down, the
    // same as a finger letting go.
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.keyDown(tile, { key: ' ' })
    expect(onChange).toHaveBeenCalledWith([entries[1], entries[0]])
  })

  /**
   * Which gesture a touch turns out to be.
   *
   * This is the whole reason the tile waits before it lifts: the picker sits in
   * a form that scrolls, and the same finger on the same pixel has to be able to
   * mean either thing. Holding still is the declaration. Nothing below needs
   * layout, which is what makes it testable at all — where the tile then *goes*
   * is arithmetic, and that lives in photoGrid.test.ts.
   */
  it('lifts a tile once a finger has held it still', () => {
    vi.useFakeTimers()
    try {
      render(
        <PhotoPicker photos={[stored('a'), stored('b')]} onChange={vi.fn()} storedUrls={new Map()} />,
      )
      const tile = screen.getByLabelText('사진 1')

      fireEvent.pointerDown(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 40 })
      expect(tile.getAttribute('aria-pressed')).toBe('false')

      act(() => void vi.advanceTimersByTime(300))
      expect(tile.getAttribute('aria-pressed')).toBe('true')
    } finally {
      vi.useRealTimers()
    }
  })

  it('leaves a finger that set off to scroll alone', () => {
    vi.useFakeTimers()
    try {
      render(
        <PhotoPicker photos={[stored('a'), stored('b')]} onChange={vi.fn()} storedUrls={new Map()} />,
      )
      const tile = screen.getByLabelText('사진 1')

      fireEvent.pointerDown(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 40 })
      fireEvent.pointerMove(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 80 })
      act(() => void vi.advanceTimersByTime(300))

      // Never lifted, so nothing was ever prevented and the page scrolled.
      expect(tile.getAttribute('aria-pressed')).toBe('false')
    } finally {
      vi.useRealTimers()
    }
  })

  it('drops a dragged photo into the slot the finger left it over', () => {
    vi.useFakeTimers()
    try {
      const onChange = vi.fn()
      const entries = [stored('a'), stored('b'), stored('c')]
      render(<PhotoPicker photos={entries} onChange={onChange} storedUrls={new Map()} />)
      const tile = screen.getByLabelText('사진 1')

      fireEvent.pointerDown(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 40 })
      act(() => void vi.advanceTimersByTime(300))

      // Two columns to the right — 96px of pitch each — so it is over the third.
      fireEvent.pointerMove(tile, { pointerId: 1, pointerType: 'touch', clientX: 232, clientY: 40 })
      expect(onChange).not.toHaveBeenCalled()

      fireEvent.pointerUp(tile, { pointerId: 1, pointerType: 'touch', clientX: 232, clientY: 40 })
      // The list is rewritten when the tile finishes settling, not the instant
      // the finger leaves — that is what keeps the drop from jumping.
      expect(onChange).not.toHaveBeenCalled()
      act(() => void vi.advanceTimersByTime(300))

      expect(onChange).toHaveBeenCalledWith([entries[1], entries[2], entries[0]])
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * The slop measures the finger, and the finger is on the glass.
   *
   * A pan scrolls the page under the finger at 1:1, so in page space the point
   * under it barely moves at all — measure the hold there and a scroll reads as
   * a finger holding perfectly still, which is the one thing that lifts a tile.
   * The photo grid sits at the top of an eleven-field form, so starting a scroll
   * on a photo is the ordinary case, not an edge one.
   */
  it('lets a finger scroll even when the page keeps up with it', () => {
    vi.useFakeTimers()
    const scrolled = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0)
    try {
      render(
        <PhotoPicker
          photos={[stored('a'), stored('b')]}
          onChange={vi.fn()}
          storedUrls={new Map()}
        />,
      )
      const tile = screen.getByLabelText('사진 1')

      fireEvent.pointerDown(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 400 })

      // The finger travels 30px up the glass and the page follows it exactly.
      scrolled.mockReturnValue(30)
      fireEvent.pointerMove(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 370 })
      act(() => void vi.advanceTimersByTime(300))

      expect(tile.getAttribute('aria-pressed')).toBe('false')
    } finally {
      scrolled.mockRestore()
      vi.useRealTimers()
    }
  })

  it('keeps the tile under the cursor when the page scrolls mid-drag', () => {
    // A mouse drag never blocks the wheel — only touch panning is prevented — so
    // the page can move under a lifted tile. Everything the drag measures is in
    // page coordinates for that reason, and the tile's own offset has to be too:
    // from client deltas alone it drifts by however far the page scrolled, while
    // the drop still lands where the cursor is. You then aim with the tile and
    // miss by exactly that much.
    vi.useFakeTimers()
    const scrolled = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0)
    try {
      render(
        <PhotoPicker
          photos={[stored('a'), stored('b')]}
          onChange={vi.fn()}
          storedUrls={new Map()}
        />,
      )
      const tile = screen.getByLabelText('사진 1')

      fireEvent.pointerDown(tile, { pointerId: 1, pointerType: 'mouse', clientX: 40, clientY: 40 })
      fireEvent.pointerMove(tile, { pointerId: 1, pointerType: 'mouse', clientX: 40, clientY: 50 })

      // The wheel turns: the cursor has not moved on screen, the page has.
      scrolled.mockReturnValue(100)
      fireEvent.pointerMove(tile, { pointerId: 1, pointerType: 'mouse', clientX: 40, clientY: 50 })

      expect(tile.parentElement?.style.transform).toContain('110px')
    } finally {
      scrolled.mockRestore()
      vi.useRealTimers()
    }
  })

  /**
   * The settle waits for the transition that is in force when the tile lands.
   *
   * Which is not the one in force when it lifts: the movement's duration comes
   * from the `[data-rearranging]` rule, and that attribute only exists while
   * something is held. Read at lift, the tile answers with its resting rule
   * instead — today the same number, and the day the two want different speeds,
   * a commit that cuts the movement short and drops the tile a jump from where
   * it was going. Here the resting rule is "no transition", so reading at the
   * wrong moment shows up as committing immediately.
   */
  it('waits for the transition the tile has when it lands, not when it lifts', () => {
    vi.useFakeTimers()
    try {
      const onChange = vi.fn()
      const entries = [stored('a'), stored('b'), stored('c')]
      render(<PhotoPicker photos={entries} onChange={onChange} storedUrls={new Map()} />)
      const tile = screen.getByLabelText('사진 1')

      fireEvent.pointerDown(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 40 })
      act(() => void vi.advanceTimersByTime(300))

      // Stands in for what [data-rearranging] turns on, which arrives after the
      // lift and not before it.
      if (tile.parentElement) tile.parentElement.style.transitionDuration = '150ms'

      fireEvent.pointerMove(tile, { pointerId: 1, pointerType: 'touch', clientX: 232, clientY: 40 })
      fireEvent.pointerUp(tile, { pointerId: 1, pointerType: 'touch', clientX: 232, clientY: 40 })

      act(() => void vi.advanceTimersByTime(100))
      expect(onChange).not.toHaveBeenCalled()

      act(() => void vi.advanceTimersByTime(100))
      expect(onChange).toHaveBeenCalledWith([entries[1], entries[2], entries[0]])
    } finally {
      vi.useRealTimers()
    }
  })

  it('gives an interrupted drag back rather than guessing at it', () => {
    vi.useFakeTimers()
    try {
      const onChange = vi.fn()
      render(
        <PhotoPicker
          photos={[stored('a'), stored('b')]}
          onChange={onChange}
          storedUrls={new Map()}
        />,
      )
      const tile = screen.getByLabelText('사진 1')

      fireEvent.pointerDown(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 40 })
      act(() => void vi.advanceTimersByTime(300))
      fireEvent.pointerMove(tile, { pointerId: 1, pointerType: 'touch', clientX: 136, clientY: 40 })
      // The system took the pointer away — a call, a gesture the browser claimed.
      fireEvent.pointerCancel(tile, { pointerId: 1, pointerType: 'touch' })
      act(() => void vi.advanceTimersByTime(300))

      expect(onChange).not.toHaveBeenCalled()
      expect(tile.getAttribute('aria-pressed')).toBe('false')
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * Two things that answer after the list has moved on.
   *
   * Both used to close over the list from the render that started them, so a
   * photo removed while one was in flight came back when it landed — and if it
   * was a picked one, `removeAt` had already revoked its preview, so what came
   * back was a tile pointing at a URL that no longer resolves.
   */
  it('keeps a removal that happens while a drop is still settling', () => {
    vi.useFakeTimers()
    try {
      const onChange = vi.fn()
      const entries = [stored('a'), stored('b'), stored('c')]
      render(<PhotoPicker photos={entries} onChange={onChange} storedUrls={new Map()} />)
      const tile = screen.getByLabelText('사진 1')

      fireEvent.pointerDown(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 40 })
      act(() => void vi.advanceTimersByTime(300))
      fireEvent.pointerMove(tile, { pointerId: 1, pointerType: 'touch', clientX: 232, clientY: 40 })
      fireEvent.pointerUp(tile, { pointerId: 1, pointerType: 'touch', clientX: 232, clientY: 40 })

      // Inside the settle, before the reorder has been committed.
      fireEvent.click(screen.getByLabelText('사진 2 삭제'))
      act(() => void vi.advanceTimersByTime(500))

      // The removal, and nothing after it: the pending drop held positions in a
      // list that no longer exists, so it was dropped rather than replayed.
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith([entries[0], entries[2]])
    } finally {
      vi.useRealTimers()
    }
  })

  it('adds newly picked photos to the list as it is when they finish, not as it was', async () => {
    const onChange = vi.fn()
    const entries = [stored('a'), stored('b')]
    let finish: ((photo: ProcessedPhoto) => void) | undefined
    processPhotoMock.mockReturnValue(
      new Promise<ProcessedPhoto>((resolve) => {
        finish = resolve
      }),
    )

    const { container, rerender } = render(
      <PhotoPicker photos={entries} onChange={onChange} storedUrls={new Map()} />,
    )

    const input = container.querySelector('input[type=file]')
    if (!input) throw new Error('파일 입력을 찾지 못함')
    fireEvent.change(input, { target: { files: [new File([], 'a.jpg', { type: 'image/jpeg' })] } })

    // Decoding takes hundreds of milliseconds, and the delete button stays live
    // through all of it.
    fireEvent.click(screen.getByLabelText('사진 1 삭제'))
    expect(onChange).toHaveBeenLastCalledWith([entries[1]])
    rerender(<PhotoPicker photos={[entries[1]]} onChange={onChange} storedUrls={new Map()} />)

    const blob = new Blob()
    const decoded: ProcessedPhoto = {
      full: blob,
      thumb: blob,
      width: 1,
      height: 1,
      ext: 'webp',
      previewUrl: 'blob:decoded',
    }
    await act(async () => {
      finish?.(decoded)
    })

    expect(onChange).toHaveBeenLastCalledWith([entries[1], { kind: 'picked', photo: decoded }])
  })

  it('puts a photo back where it was when the move is abandoned', () => {
    const onChange = vi.fn()
    render(
      <PhotoPicker
        photos={[stored('a'), picked('blob:new')]}
        onChange={onChange}
        storedUrls={new Map()}
      />,
    )

    const tile = screen.getByLabelText('사진 2')
    fireEvent.keyDown(tile, { key: ' ' })
    fireEvent.keyDown(tile, { key: 'ArrowLeft' })
    fireEvent.keyDown(tile, { key: 'Escape' })

    expect(onChange).not.toHaveBeenCalled()
    expect(tile.getAttribute('aria-pressed')).toBe('false')
  })
})
