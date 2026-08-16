/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PhotoEntry } from '@/entities/item'
import type { ProcessedPhoto } from '@/shared/lib/image'
import { PhotoPicker } from './PhotoPicker'

/**
 * 편집 화면이 더한 타일 — 이미 스토리지에 있는 사진이, 방금 고른 사진과 같은 행에 앉는다.
 *
 * 여기 둘은 타입 검사기가 볼 수 없는 것이다. 저장본에는 object URL이 없어 삭제 때
 * 반납해봐야 버릴 것이 없지만, 반납하지 않은 고른 사진은 탭이 사는 내내 blob을 흘린다 —
 * 그리고 둘 다 같은 세 줄 함수에서 일어난다. 그리고 서명 URL은 타일보다 늦게 오므로
 * "아직 안 왔다"와 "안 왔다"가 갈려 있어야 한다. 아니면 콜드 오픈이 깨진 사진 다섯 장이 된다.
 */

const { releasePreviewMock, processPhotoMock } = vi.hoisted(() => ({
  releasePreviewMock: vi.fn(),
  processPhotoMock: vi.fn(),
}))

vi.mock('@/shared/lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/image')>()),
  releasePreview: releasePreviewMock,
  // jsdom에는 캔버스가 없고, 이 테스트가 여기서 필요로 하는 것은 어차피 타이밍이다.
  processPhoto: processPhotoMock,
}))

/**
 * jsdom이 답할 수 없는 유일한 것 — 격자가 얼마나 크게 나왔는지.
 *
 * 측정만 대체한다(12px 간격의 84px 타일 세 열, 폰에서 스타일시트가 요구하는 그것).
 * 그것으로 끌기가 정하는 나머지는 전부 진짜 코드가 정하는 그대로다.
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

/** 타일 안의 사진을, 타일 자신의 이름으로 찾는다. */
function srcOf(label: string): string | null | undefined {
  return screen.getByLabelText(label).querySelector('img')?.getAttribute('src')
}

describe('PhotoPicker', () => {
  it('저장본은 서명 URL로, 고른 사진은 미리보기로 그린다', () => {
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

  it('"오는 중"과 "안 왔다"를 갈라 둔다', () => {
    const { rerender } = render(
      <PhotoPicker photos={[stored('a')]} onChange={vi.fn()} storedUrls={new Map()} />,
    )

    // 아직 항목이 없다 — URL이 서명되는 중이다. 여기에 실패 문구가 뜨면 평범한
    // 콜드 오픈이 사진이 사라졌다고 말하는 셈이 된다.
    expect(screen.queryByText('불러오지 못함')).toBeNull()

    rerender(
      <PhotoPicker photos={[stored('a')]} onChange={vi.fn()} storedUrls={new Map([['a', null]])} />,
    )
    expect(screen.queryByText('불러오지 못함')).not.toBeNull()
  })

  it('지운 고른 사진의 미리보기만 반납한다', () => {
    const onChange = vi.fn()
    const entries = [stored('a'), picked('blob:new')]
    const { rerender } = render(
      <PhotoPicker
        photos={entries}
        onChange={onChange}
        storedUrls={new Map([['a', 'signed://a']])}
      />,
    )

    // 저장본은 여기서 목록에서 빠질 뿐이다. 실제 삭제는 폼이 저장될 때이고, 돌려줄
    // object URL도 없다.
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

  it('대표 배지가 목록이 아니라 타일을 따라간다', () => {
    // 사진을 맨 앞으로 끄는 것이 *곧* 커버를 바꾸는 방법이라, 놓기를 기다리는 배지는
    // 제스처 내내 틀린 타일 위에 앉는다.
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

  it('키보드로도 재정렬된다 — 다른 길이 끌기뿐이므로', () => {
    const onChange = vi.fn()
    const entries = [stored('a'), picked('blob:new')]
    render(<PhotoPicker photos={entries} onChange={onChange} storedUrls={new Map()} />)

    const tile = screen.getByLabelText('사진 2')
    fireEvent.keyDown(tile, { key: ' ' })
    expect(tile.getAttribute('aria-pressed')).toBe('true')

    fireEvent.keyDown(tile, { key: 'ArrowLeft' })
    // 아직 확정된 것이 없다 — 목록은 내려놓을 때 다시 쓰이고, 손가락을 떼는 것과 같다.
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.keyDown(tile, { key: ' ' })
    expect(onChange).toHaveBeenCalledWith([entries[1], entries[0]])
  })

  /**
   * 터치가 결국 어느 제스처였는지.
   *
   * 타일이 들리기 전에 기다리는 이유의 전부다 — 피커는 스크롤되는 폼 안에 있고, 같은
   * 픽셀 위의 같은 손가락이 둘 중 어느 쪽도 될 수 있어야 한다. 가만히 있는 것이 선언이다.
   * 아래 어느 것도 레이아웃을 필요로 하지 않아서 검사할 수 있다 — 타일이 그 뒤 *어디로*
   * 가는지는 산술이고 photoGrid.test.ts에 있다.
   */
  it('손가락이 가만히 붙들고 있으면 타일이 들린다', () => {
    vi.useFakeTimers()
    try {
      render(
        <PhotoPicker
          photos={[stored('a'), stored('b')]}
          onChange={vi.fn()}
          storedUrls={new Map()}
        />,
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

  it('스크롤하러 떠난 손가락은 건드리지 않는다', () => {
    vi.useFakeTimers()
    try {
      render(
        <PhotoPicker
          photos={[stored('a'), stored('b')]}
          onChange={vi.fn()}
          storedUrls={new Map()}
        />,
      )
      const tile = screen.getByLabelText('사진 1')

      fireEvent.pointerDown(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 40 })
      fireEvent.pointerMove(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 80 })
      act(() => void vi.advanceTimersByTime(300))

      // 들린 적이 없으니 아무것도 막히지 않았고 페이지가 스크롤됐다.
      expect(tile.getAttribute('aria-pressed')).toBe('false')
    } finally {
      vi.useRealTimers()
    }
  })

  it('끈 사진을 손가락이 놓아둔 슬롯에 내려놓는다', () => {
    vi.useFakeTimers()
    try {
      const onChange = vi.fn()
      const entries = [stored('a'), stored('b'), stored('c')]
      render(<PhotoPicker photos={entries} onChange={onChange} storedUrls={new Map()} />)
      const tile = screen.getByLabelText('사진 1')

      fireEvent.pointerDown(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 40 })
      act(() => void vi.advanceTimersByTime(300))

      // 오른쪽으로 두 열 — pitch가 각각 96px — 이므로 세 번째 위다.
      fireEvent.pointerMove(tile, { pointerId: 1, pointerType: 'touch', clientX: 232, clientY: 40 })
      expect(onChange).not.toHaveBeenCalled()

      fireEvent.pointerUp(tile, { pointerId: 1, pointerType: 'touch', clientX: 232, clientY: 40 })
      // 목록은 손가락이 떠나는 순간이 아니라 타일이 내려앉기를 마칠 때 다시 쓰인다 —
      // 그것이 놓기가 튀지 않게 한다.
      expect(onChange).not.toHaveBeenCalled()
      act(() => void vi.advanceTimersByTime(300))

      expect(onChange).toHaveBeenCalledWith([entries[1], entries[2], entries[0]])
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * slop이 재는 것은 손가락이고, 손가락은 유리 위에 있다.
   *
   * 패닝은 손가락 아래 페이지를 1:1로 스크롤하므로 페이지 좌표에서 그 아래 점은 거의
   * 움직이지 않는다 — 거기서 재면 스크롤이 완벽하게 가만히 있는 손가락으로 읽히고,
   * 그것이 타일을 들어올린다. 사진 격자는 열한 필드 폼의 맨 위라, 사진에서 스크롤을
   * 시작하는 것은 예외가 아니라 평범한 경우다.
   */
  it('페이지가 손가락을 따라와도 스크롤은 스크롤로 둔다', () => {
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

      // 손가락이 유리 위를 30px 올라가고 페이지가 정확히 따라온다.
      scrolled.mockReturnValue(30)
      fireEvent.pointerMove(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 370 })
      act(() => void vi.advanceTimersByTime(300))

      expect(tile.getAttribute('aria-pressed')).toBe('false')
    } finally {
      scrolled.mockRestore()
      vi.useRealTimers()
    }
  })

  it('끌기 도중 페이지가 스크롤돼도 타일이 커서 아래 남는다', () => {
    // 마우스 끌기는 휠을 막지 않으므로(막는 것은 터치 패닝뿐) 들린 타일 아래에서 페이지가
    // 움직일 수 있다. 끌기가 재는 모든 것이 페이지 좌표인 이유가 그것이고, 타일 자신의
    // 오프셋도 그래야 한다 — client 델타만으로는 페이지가 스크롤된 만큼 떠내려가는데
    // 놓기는 여전히 커서 자리에 앉는다. 그러면 타일로 겨누고 딱 그만큼 빗나간다.
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

      // 휠이 돈다 — 커서는 화면에서 움직이지 않았고 페이지가 움직였다.
      scrolled.mockReturnValue(100)
      fireEvent.pointerMove(tile, { pointerId: 1, pointerType: 'mouse', clientX: 40, clientY: 50 })

      expect(tile.parentElement?.style.transform).toContain('110px')
    } finally {
      scrolled.mockRestore()
      vi.useRealTimers()
    }
  })

  /**
   * "끌리는 타일은 애니메이션하지 않는다"의 이 파일 몫 절반.
   *
   * 나머지 절반은 이 속성에 걸린 스타일시트 규칙이고, 여기서는 평가할 수 없다 —
   * jsdom에 CSS가 없다. 이것이 붙드는 것은 둘 사이의 계약이다. 속성을 빼면 규칙이
   * 맞지 않고, 타일이 이미 지나간 손가락을 애니메이션으로 뒤쫓는다.
   *
   * 그 규칙이 인라인 스타일이 *아닌* 것은 의도다. 놓기가 이 요소의 computed
   * transition-duration을 읽어 기다릴 시간을 재므로, 컴포넌트가 요소에 쓰는 것은
   * 자기 질문에 자기가 답하게 된다.
   */
  it('손가락이 올라간 타일을 표시한다 — 그것이 트랜지션을 끈다', () => {
    vi.useFakeTimers()
    try {
      render(
        <PhotoPicker
          photos={[stored('a'), stored('b')]}
          onChange={vi.fn()}
          storedUrls={new Map()}
        />,
      )
      const tile = screen.getByLabelText('사진 1')

      fireEvent.pointerDown(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 40 })
      act(() => void vi.advanceTimersByTime(300))
      fireEvent.pointerMove(tile, { pointerId: 1, pointerType: 'touch', clientX: 120, clientY: 40 })
      expect(tile.parentElement?.dataset.following).toBe('true')

      // 끌기 도중인 *여기서* 검사한다. 놓기가 측정을 하는 순간이 이때이고, 손가락이
      // 닿아 있는 동안 트랜지션에 관한 것이 인라인이면 안 된다. 놓은 뒤에는 어차피
      // 비어 있어 거기서 검사하면 아무것도 증명하지 못한다.
      expect(tile.parentElement?.style.transition).toBe('')
      expect(tile.parentElement?.style.transitionProperty).toBe('')

      // 놓으면 다시 애니메이션한다 — 그것이 내려앉기이고, 같은 속성이 비켜서는 것이다.
      fireEvent.pointerUp(tile, { pointerId: 1, pointerType: 'touch', clientX: 120, clientY: 40 })
      expect(tile.parentElement?.dataset.following).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * 내려앉기는 타일이 도착할 때 유효한 트랜지션을 기다린다.
   *
   * 들릴 때 유효한 것이 아니다. 이동의 duration은 `[data-rearranging]` 규칙에서 오고
   * 그 속성은 무언가 집혀 있는 동안에만 있다. 들릴 때 읽으면 타일이 쉬는 규칙으로
   * 답한다 — 오늘은 같은 숫자이고, 둘이 다른 속도를 원하는 날에는 이동을 잘라 타일이
   * 가려던 자리에서 튄 채 확정된다.
   *
   * 아래 duration은 심은 것이다. jsdom에 스타일시트가 없기 때문이다. 그래서 이것은
   * 읽기가 *언제* 일어나는지에 대한 테스트일 뿐이다.
   */
  it('들릴 때가 아니라 도착할 때의 트랜지션을 기다린다', () => {
    vi.useFakeTimers()
    try {
      const onChange = vi.fn()
      const entries = [stored('a'), stored('b'), stored('c')]
      render(<PhotoPicker photos={entries} onChange={onChange} storedUrls={new Map()} />)
      const tile = screen.getByLabelText('사진 1')

      fireEvent.pointerDown(tile, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 40 })
      act(() => void vi.advanceTimersByTime(300))

      // [data-rearranging]이 켜는 것을 대신한다. 그것은 들린 뒤에 오지 그 전이 아니다.
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

  it('끊긴 끌기는 추측하지 않고 되돌려준다', () => {
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
      // 시스템이 포인터를 가져갔다 — 전화, 브라우저가 가져간 제스처.
      fireEvent.pointerCancel(tile, { pointerId: 1, pointerType: 'touch' })
      act(() => void vi.advanceTimersByTime(300))

      expect(onChange).not.toHaveBeenCalled()
      expect(tile.getAttribute('aria-pressed')).toBe('false')
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * 목록이 이미 움직인 뒤에 답하는 둘.
   *
   * 둘 다 자신을 시작한 렌더의 목록을 붙들고 있었어서, 그 사이에 지운 사진이 도착하며
   * 되살아났다 — 고른 사진이었다면 `removeAt`이 이미 미리보기를 반납한 뒤라, 되살아난
   * 것은 더 이상 풀리지 않는 URL을 가리키는 타일이었다.
   */
  it('놓기가 내려앉는 도중에 일어난 삭제를 지킨다', () => {
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

      // 내려앉는 도중, 재정렬이 확정되기 전.
      fireEvent.click(screen.getByLabelText('사진 2 삭제'))
      act(() => void vi.advanceTimersByTime(500))

      // 삭제만 있고 그 뒤는 없다 — 대기 중이던 놓기는 더는 없는 목록의 위치를 들고
      // 있었으므로 재생되지 않고 버려졌다.
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith([entries[0], entries[2]])
    } finally {
      vi.useRealTimers()
    }
  })

  it('새로 고른 사진을 시작할 때가 아니라 끝날 때의 목록에 더한다', async () => {
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

    // 디코딩은 수백 밀리초가 걸리고, 그동안 삭제 버튼은 계속 살아 있다.
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

  it('이동을 포기하면 사진을 제자리에 되돌린다', () => {
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
