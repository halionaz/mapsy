/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PhotoViewer } from './PhotoViewer'
import type { PhotoSlot } from '../lib/photoSlots'

/**
 * 제스처도 페이징도 아니고 **요청 모드**만 본다. 기하는 `photoTransform.test.ts`가,
 * 슬롯 규칙은 `photoSlots.test.ts`가 이미 든다.
 *
 * 이 한 가지를 여기서 따로 붙드는 이유는 뷰어가 자기 `<img>`로 요청하기 때문이다.
 * `SquarePhoto.test.tsx`가 두 자리를 덮어도 여기는 비어 있었고, 하필 1280px 원본을
 * 그리는 — 캐시 이득이 가장 큰 — 자리다. 빠져도 화면은 멀쩡하고 조용해지는 것은
 * 캐시뿐이라 사람이 알아채지 못한다.
 */

// vitest는 `globals`를 켜지 않아 testing-library가 스스로 정리하지 못한다 — 저장소의
// 다른 렌더 테스트들과 같은 규약이다.
afterEach(cleanup)

const SLOT: PhotoSlot = {
  id: 'a',
  state: 'ready',
  url: 'https://signed/a',
  thumbUrl: 'https://signed/a-thumb',
}

describe('PhotoViewer', () => {
  it('사진을 CORS로 요청한다', () => {
    render(
      <PhotoViewer
        slots={[SLOT]}
        startId="a"
        title="셔츠"
        onLoadError={() => {}}
        onClose={() => {}}
      />,
    )

    expect(screen.getByAltText('셔츠 사진 1')).toHaveProperty('crossOrigin', 'anonymous')
  })

  /**
   * 닫기가 `dialog.close()`를 부르고, 그 이벤트가 `onClose`로 돌아온다.
   *
   * 두 겹을 한 번에 붙든다. 뷰어에는 닫는 길이 이것 하나뿐이라 끊기면 사용자가 사진에
   * 갇히고, 동시에 `vitest.setup.ts`의 `<dialog>` 스텁이 `close` 이벤트를 쏘는지도
   * 여기서만 드러난다 — 그 가짜가 조용해지면 멀쩡한 코드가 테스트에서만 죽는다.
   */
  it('닫기를 누르면 뷰어를 닫는다', () => {
    const onClose = vi.fn()
    render(
      <PhotoViewer
        slots={[SLOT]}
        startId="a"
        title="셔츠"
        onLoadError={() => {}}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByLabelText('사진 닫기'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
